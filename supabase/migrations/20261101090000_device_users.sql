-- The device belongs to the shop, not to an account (ADR-053).
--
-- Any member of the shop can deliver what a phone keeps. Who may be named
-- as the seller of a sale delivered by someone else: a person seen on this
-- device, which a sale made offline requires (the shop data only reaches a
-- phone through an online session). A name that is not here is ignored.

create table app.device_users (
  organization_id uuid not null,
  device_id uuid not null,
  user_id uuid not null,
  first_seen_at timestamptz not null default now(),
  primary key (organization_id, device_id, user_id),
  foreign key (organization_id, device_id)
    references app.devices (organization_id, id) on delete restrict,
  foreign key (organization_id, user_id)
    references app.organization_memberships (organization_id, user_id) on delete restrict
);

create index device_users_user_idx on app.device_users (organization_id, user_id);

-- Whoever registered a device has been on it.
insert into app.device_users (organization_id, device_id, user_id, first_seen_at)
select organization_id, id, user_id, created_at
  from app.devices;

revoke all on app.device_users from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.device_users from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.device_users from authenticated';
  end if;
end
$$;

grant select, insert on app.device_users to nagaw_api;

alter table app.device_users enable row level security;
create policy api_access on app.device_users
  for all to nagaw_api using (true) with check (true);
