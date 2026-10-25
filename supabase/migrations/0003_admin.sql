-- Admin role: read-only visibility across the platform, plus organization approval.
-- Run after 0002_profile_address.sql.
--
-- Admins cannot be created through signup (handle_new_user only allows donor / org).
-- Promote an existing account once, from the SQL editor:
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('donor', 'org', 'admin'));

-- security definer so policies can call it without re-triggering profiles' own RLS
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Admins can read everything. They cannot write directly; changes go through the functions below.
create policy "profiles: admin reads all" on public.profiles
  for select using (public.is_admin());

create policy "donations: admin reads all" on public.donations
  for select using (public.is_admin());

create policy "claims: admin reads all" on public.claims
  for select using (public.is_admin());

-- Approve or revoke an organization.
create or replace function public.set_org_verified(p_org_id uuid, p_verified boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  update profiles
     set is_verified = p_verified
   where id = p_org_id and role = 'org'
   returning * into result;

  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

-- Platform-wide numbers for the admin dashboard, computed in one round trip.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'donors',           (select count(*) from profiles where role = 'donor'),
    'orgs',             (select count(*) from profiles where role = 'org'),
    'orgs_verified',    (select count(*) from profiles where role = 'org' and is_verified),
    'orgs_pending',     (select count(*) from profiles where role = 'org' and not is_verified),
    'donations',        (select count(*) from donations),
    'by_status',        coalesce(
                          (select jsonb_object_agg(status, n)
                             from (select status, count(*) as n from donations group by status) s),
                          '{}'::jsonb),
    'servings_listed',  (select coalesce(sum(quantity), 0) from donations),
    'servings_rescued', (select coalesce(sum(quantity), 0) from donations where status = 'picked_up')
  );
end;
$$;

revoke all on function public.set_org_verified(uuid, boolean) from public, anon;
revoke all on function public.admin_stats()                   from public, anon;
grant execute on function public.set_org_verified(uuid, boolean) to authenticated;
grant execute on function public.admin_stats()                   to authenticated;

-- Let admins see new organizations and approvals appear live.
alter publication supabase_realtime add table public.profiles;
