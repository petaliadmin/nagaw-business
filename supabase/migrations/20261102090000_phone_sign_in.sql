-- Sign-in with a phone number and a 4-digit secret code (ADR-058).
--
-- The number lives in auth.users.phone (international digits, no `+`), set
-- by the API with the Supabase secret key. The profile copies it, as it
-- copies the e-mail, and `contact` is what the application shows of a
-- person: the number when there is one, the e-mail otherwise. Invitations
-- are bound to a number; those already sent to an address keep working.

-- ---------------------------------------------------------------------------
-- Profiles: number and contact
-- ---------------------------------------------------------------------------

alter table app.user_profiles
  add column phone text not null default ''
    check (phone = '' or phone ~ '^[1-9][0-9]{7,14}$'),
  add column contact text generated always as (
    case when phone <> '' then '+' || phone else email end
  ) stored;

-- Supabase keeps one account per number; the profile says so too.
create unique index user_profiles_phone_idx
  on app.user_profiles (phone) where phone <> '';

create or replace function app.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into app.user_profiles (id, email, phone)
    values (new.id, coalesce(new.email, ''), coalesce(new.phone, ''));
  else
    if new.email is distinct from old.email then
      update app.user_profiles set email = coalesce(new.email, '') where id = new.id;
    end if;
    if new.phone is distinct from old.phone then
      update app.user_profiles set phone = coalesce(new.phone, '') where id = new.id;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app.handle_auth_user_change() from public;

create trigger on_auth_user_phone_updated
  after update of phone on auth.users
  for each row execute function app.handle_auth_user_change();

update app.user_profiles p
   set phone = u.phone
  from auth.users u
 where u.id = p.id and coalesce(u.phone, '') <> '';

-- ---------------------------------------------------------------------------
-- Invitations bound to a number
-- ---------------------------------------------------------------------------

alter table app.organization_invitations
  alter column email drop not null,
  add column phone text check (phone ~ '^[1-9][0-9]{7,14}$'),
  add constraint organization_invitations_one_contact_check
    check ((email is null) <> (phone is null));

create unique index organization_invitations_one_pending_phone_idx
  on app.organization_invitations (organization_id, phone)
  where status = 'pending' and phone is not null;

-- ---------------------------------------------------------------------------
-- Failed codes: a number is locked after too many (thresholds in settings)
-- ---------------------------------------------------------------------------

alter table app.platform_settings
  add column pin_max_failures integer not null default 5
    check (pin_max_failures between 3 and 20),
  add column pin_lock_minutes integer not null default 15
    check (pin_lock_minutes between 1 and 1440);

create table app.phone_sign_in_failures (
  phone text primary key check (phone ~ '^[1-9][0-9]{7,14}$'),
  failures integer not null default 0 check (failures >= 0),
  locked_until timestamptz,
  last_failed_at timestamptz not null default now()
);

revoke all on app.phone_sign_in_failures from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.phone_sign_in_failures from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.phone_sign_in_failures from authenticated';
  end if;
end
$$;

-- No delete, as everywhere in `app`: a success puts the counter back to 0.
grant select, insert, update on app.phone_sign_in_failures to nagaw_api;

alter table app.phone_sign_in_failures enable row level security;
create policy api_access on app.phone_sign_in_failures
  for all to nagaw_api using (true) with check (true);
