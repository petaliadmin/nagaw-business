-- Phase 11 — selling without network (ADR-020, ADR-025).
--
-- A device (phone, computer) is registered before it may sell offline. It
-- numbers its offline tickets with its own prefix (B-000012); the server
-- still gives every sale its gapless sale_number when it arrives. A sale
-- made offline keeps the price the seller saw; when it differs from the
-- catalogue, it is flagged for review instead of being refused afterwards.

-- ---------------------------------------------------------------------------
-- Settings, per organization (never hard-coded)
-- ---------------------------------------------------------------------------

alter table app.organizations
  -- Oldest offline sale accepted at synchronization.
  add column max_offline_days integer not null default 7
    check (max_offline_days between 1 and 90),
  add column max_devices integer not null default 20
    check (max_devices between 1 and 500),
  -- Number of the next device of the shop (its ticket prefix).
  add column next_device_number integer not null default 1
    check (next_device_number >= 1);

-- ---------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------

create table app.devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  user_id uuid not null,
  label text not null check (label = btrim(label) and char_length(label) between 1 and 60),
  -- Letters A, B, … Z, AA, AB…: printed before offline ticket numbers.
  ticket_prefix text not null check (ticket_prefix ~ '^[A-Z]{1,3}$'),
  client_operation_id uuid not null,
  last_synced_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, ticket_prefix),
  unique (organization_id, client_operation_id),
  check ((revoked_at is null) = (revoked_by is null)),
  foreign key (organization_id, user_id)
    references app.organization_memberships (organization_id, user_id) on delete restrict
);

create index devices_user_idx on app.devices (organization_id, user_id);
create index devices_revoked_by_idx on app.devices (revoked_by) where revoked_by is not null;

-- ---------------------------------------------------------------------------
-- Sales made on a device
-- ---------------------------------------------------------------------------

alter table app.sales
  add column device_id uuid,
  -- Ticket number printed offline, e.g. B-000012.
  add column device_ticket text check (device_ticket ~ '^[A-Z]{1,3}-[0-9]{6}$'),
  -- Offline price different from the catalogue at synchronization.
  add column price_review boolean not null default false,
  add column synced_at timestamptz,
  add constraint sales_device_fkey foreign key (organization_id, device_id)
    references app.devices (organization_id, id) on delete restrict,
  add constraint sales_device_ticket_key unique (organization_id, device_ticket),
  add constraint sales_device_link_check
    check ((device_ticket is null) = (device_id is null));

create index sales_device_idx on app.sales (organization_id, device_id) where device_id is not null;
create index sales_price_review_idx on app.sales (organization_id) where price_review;

-- The cancellation trigger compares every other column: the new ones are
-- covered as they are part of the row (no change needed).

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on app.devices from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.devices from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.devices from authenticated';
  end if;
end
$$;

grant select, insert, update on app.devices to nagaw_api;

alter table app.devices enable row level security;
create policy api_access on app.devices
  for all to nagaw_api using (true) with check (true);
