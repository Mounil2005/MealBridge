-- MealBridge schema: profiles, donations, claims, with row level security and
-- server-side functions that make claiming / pickup atomic.
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  role           text not null check (role in ('donor', 'org')),
  name           text not null,
  phone          text,
  lat            double precision,
  lng            double precision,
  -- organizations only
  capacity       integer not null default 50 check (capacity > 0),
  max_radius_km  double precision not null default 15 check (max_radius_km > 0),
  -- set by an admin in the Supabase dashboard, never by the user
  is_verified    boolean not null default false,
  created_at     timestamptz not null default now()
);

create table public.donations (
  id               uuid primary key default gen_random_uuid(),
  donor_id         uuid not null references public.profiles (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 120),
  description      text check (char_length(description) <= 500),
  quantity         integer not null check (quantity > 0),
  prepared_at      timestamptz not null,
  pickup_deadline  timestamptz not null,
  address          text,
  lat              double precision not null,
  lng              double precision not null,
  photo_url        text,
  status           text not null default 'available'
                     check (status in ('available', 'claimed', 'picked_up', 'expired', 'cancelled')),
  created_at       timestamptz not null default now(),
  constraint deadline_after_prepared check (pickup_deadline > prepared_at)
);

create table public.claims (
  id             uuid primary key default gen_random_uuid(),
  donation_id    uuid not null references public.donations (id) on delete cascade,
  org_id         uuid not null references public.profiles (id) on delete cascade,
  claimed_at     timestamptz not null default now(),
  picked_up_at   timestamptz,
  released_at    timestamptz
);

-- A donation can have at most one active (not released) claim.
create unique index one_active_claim_per_donation
  on public.claims (donation_id) where released_at is null;

create index donations_status_deadline_idx on public.donations (status, pickup_deadline);
create index donations_donor_idx on public.donations (donor_id);
create index claims_org_idx on public.claims (org_id);

-- ---------------------------------------------------------------------------
-- Create a profile automatically when a user signs up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'donor');
begin
  -- Never trust the client for anything but the two public roles.
  if requested_role not in ('donor', 'org') then
    requested_role := 'donor';
  end if;

  insert into public.profiles (id, role, name)
  values (
    new.id,
    requested_role,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers (security definer so policies can look across tables without
-- triggering each other's policies, which would cause infinite recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_verified_org()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles
                 where id = auth.uid() and role = 'org' and is_verified);
$$;

create or replace function public.is_donor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'donor');
$$;

-- True when the current user and `other` are the two parties of an active claim.
create or replace function public.shares_active_claim_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from claims c
    join donations d on d.id = c.donation_id
    where c.released_at is null
      and ((d.donor_id = auth.uid() and c.org_id = other)
        or (c.org_id = auth.uid() and d.donor_id = other))
  );
$$;

-- Does the current user hold a claim on this donation?
create or replace function public.has_claim_on(p_donation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from claims
                 where donation_id = p_donation_id and org_id = auth.uid());
$$;

-- Is the current user the donor of this donation?
create or replace function public.owns_donation(p_donation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from donations
                 where id = p_donation_id and donor_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles  enable row level security;
alter table public.donations enable row level security;
alter table public.claims    enable row level security;

-- profiles: you see yourself; a claim's two parties can see each other (for contact details)
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles: read claim counterpart" on public.profiles
  for select using (public.shares_active_claim_with(id));

create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Users may only edit these columns. role and is_verified are locked.
revoke update on public.profiles from authenticated, anon;
grant update (name, phone, lat, lng, capacity, max_radius_km) on public.profiles to authenticated;

-- donations
create policy "donations: donor reads own" on public.donations
  for select using (donor_id = auth.uid());

create policy "donations: verified orgs read open offers and their own claims" on public.donations
  for select using (
    public.is_verified_org()
    and (
      (status = 'available' and pickup_deadline > now())
      or public.has_claim_on(id)
    )
  );

create policy "donations: donors create own" on public.donations
  for insert with check (
    donor_id = auth.uid()
    and status = 'available'
    and public.is_donor()
  );

-- Donors can edit details only while nothing has been claimed. Status changes go through functions.
create policy "donations: donor edits own available" on public.donations
  for update using (donor_id = auth.uid() and status = 'available')
  with check (donor_id = auth.uid() and status = 'available');

create policy "donations: donor deletes own available" on public.donations
  for delete using (donor_id = auth.uid() and status in ('available', 'expired', 'cancelled'));

-- claims: read-only for the two parties; all writes go through functions below
create policy "claims: org reads own" on public.claims
  for select using (org_id = auth.uid());

create policy "claims: donor reads claims on own donations" on public.claims
  for select using (public.owns_donation(donation_id));

revoke insert, update, delete on public.claims from authenticated, anon;

-- ---------------------------------------------------------------------------
-- State transitions (atomic, validated server-side)
-- ---------------------------------------------------------------------------

-- Organization claims an available donation. Row lock prevents two orgs winning the same offer.
create or replace function public.claim_donation(p_donation_id uuid)
returns public.claims
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.donations;
  result public.claims;
begin
  if not public.is_verified_org() then
    raise exception 'Only verified organizations can claim donations' using errcode = '42501';
  end if;

  select * into d from donations where id = p_donation_id for update;
  if not found then
    raise exception 'Donation not found' using errcode = 'P0002';
  end if;
  if d.status <> 'available' then
    raise exception 'This donation is no longer available' using errcode = 'P0001';
  end if;
  if d.pickup_deadline <= now() then
    update donations set status = 'expired' where id = d.id;
    raise exception 'This donation has expired' using errcode = 'P0001';
  end if;

  insert into claims (donation_id, org_id) values (d.id, auth.uid()) returning * into result;
  update donations set status = 'claimed' where id = d.id;
  return result;
end;
$$;

-- Organization confirms it collected the food.
create or replace function public.mark_picked_up(p_donation_id uuid)
returns public.claims
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.claims;
begin
  update claims
     set picked_up_at = now()
   where donation_id = p_donation_id
     and org_id = auth.uid()
     and released_at is null
     and picked_up_at is null
   returning * into result;

  if not found then
    raise exception 'No active claim to mark as picked up' using errcode = 'P0001';
  end if;

  update donations set status = 'picked_up' where id = p_donation_id;
  return result;
end;
$$;

-- Organization gives a claimed donation back so someone else can take it.
create or replace function public.release_claim(p_donation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.donations;
begin
  select * into d from donations where id = p_donation_id for update;

  update claims
     set released_at = now()
   where donation_id = p_donation_id
     and org_id = auth.uid()
     and released_at is null
     and picked_up_at is null;

  if not found then
    raise exception 'No active claim to release' using errcode = 'P0001';
  end if;

  update donations
     set status = case when d.pickup_deadline > now() then 'available' else 'expired' end
   where id = p_donation_id;
end;
$$;

-- Donor withdraws a donation that has not been collected yet.
create or replace function public.cancel_donation(p_donation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update donations
     set status = 'cancelled'
   where id = p_donation_id
     and donor_id = auth.uid()
     and status in ('available', 'claimed');

  if not found then
    raise exception 'Donation cannot be cancelled' using errcode = 'P0001';
  end if;

  update claims set released_at = now()
   where donation_id = p_donation_id and released_at is null and picked_up_at is null;
end;
$$;

-- Marks overdue, uncollected donations as expired. Safe to call often (the app calls it on load).
create or replace function public.expire_overdue_donations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with expired as (
    update donations
       set status = 'expired'
     where status in ('available', 'claimed')
       and pickup_deadline <= now()
     returning id
  ), released as (
    update claims set released_at = now()
     where donation_id in (select id from expired)
       and released_at is null and picked_up_at is null
  )
  select count(*) into n from expired;
  return n;
end;
$$;

revoke all on function public.is_verified_org()                  from public, anon;
revoke all on function public.is_donor()                         from public, anon;
revoke all on function public.shares_active_claim_with(uuid)     from public, anon;
revoke all on function public.has_claim_on(uuid)                 from public, anon;
revoke all on function public.owns_donation(uuid)                from public, anon;
grant execute on function public.is_verified_org()               to authenticated;
grant execute on function public.is_donor()                      to authenticated;
grant execute on function public.shares_active_claim_with(uuid)  to authenticated;
grant execute on function public.has_claim_on(uuid)              to authenticated;
grant execute on function public.owns_donation(uuid)             to authenticated;
revoke all on function public.claim_donation(uuid)        from public, anon;
revoke all on function public.mark_picked_up(uuid)        from public, anon;
revoke all on function public.release_claim(uuid)         from public, anon;
revoke all on function public.cancel_donation(uuid)       from public, anon;
revoke all on function public.expire_overdue_donations()  from public, anon;
grant execute on function public.claim_donation(uuid)        to authenticated;
grant execute on function public.mark_picked_up(uuid)        to authenticated;
grant execute on function public.release_claim(uuid)         to authenticated;
grant execute on function public.cancel_donation(uuid)       to authenticated;
grant execute on function public.expire_overdue_donations()  to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime + photo storage
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.donations;
alter publication supabase_realtime add table public.claims;

insert into storage.buckets (id, name, public)
values ('donation-photos', 'donation-photos', true)
on conflict (id) do nothing;

create policy "photos: public read" on storage.objects
  for select using (bucket_id = 'donation-photos');

-- Users may only upload into a folder named after their own user id.
create policy "photos: upload to own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'donation-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "photos: delete own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'donation-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
