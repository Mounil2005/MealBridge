-- Adds a human-readable address to profiles and lets signup seed address + location.
-- Run after 0001_init.sql.

alter table public.profiles
  add column if not exists address text check (char_length(address) <= 300);

-- Users may edit their own address (role and is_verified stay locked).
grant update (address) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_role text := coalesce(meta ->> 'role', 'donor');
begin
  -- Never trust the client for anything but the two public roles.
  if requested_role not in ('donor', 'org') then
    requested_role := 'donor';
  end if;

  insert into public.profiles (id, role, name, address, lat, lng)
  values (
    new.id,
    requested_role,
    coalesce(nullif(meta ->> 'name', ''), split_part(new.email, '@', 1)),
    left(nullif(meta ->> 'address', ''), 300),
    -- Only accept real numbers; anything else is ignored rather than failing signup.
    case when jsonb_typeof(meta -> 'lat') = 'number' then (meta ->> 'lat')::double precision end,
    case when jsonb_typeof(meta -> 'lng') = 'number' then (meta ->> 'lng')::double precision end
  );
  return new;
end;
$$;
