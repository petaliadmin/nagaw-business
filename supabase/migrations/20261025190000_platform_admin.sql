-- Phase 16 — platform administration and observability (ADR-030).
--
-- Platform administrators are kept apart from shop members and are only
-- ever added in SQL: no endpoint creates one. They see accounts, offers and
-- aggregates, never the business content of a shop (products, sales…).

-- ---------------------------------------------------------------------------
-- Platform administrators and settings
-- ---------------------------------------------------------------------------

create table app.platform_admins (
  user_id uuid primary key references app.user_profiles (id) on delete restrict,
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

-- One row: the thresholds of the alerts (never hard-coded).
create table app.platform_settings (
  id boolean primary key default true check (id),
  -- Share of refused offline operations, over 7 days, that raises an alert.
  rejection_alert_basis_points integer not null default 500
    check (rejection_alert_basis_points between 1 and 10000),
  -- Share of a quota used that raises an alert.
  quota_alert_basis_points integer not null default 9000
    check (quota_alert_basis_points between 1 and 10000),
  -- A device that sent nothing for this many days is said silent.
  silent_device_days integer not null default 3
    check (silent_device_days between 1 and 90),
  updated_at timestamptz not null default now()
);

insert into app.platform_settings default values;

create trigger platform_settings_set_updated_at
  before update on app.platform_settings
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Suspension of a shop, with its reason
-- ---------------------------------------------------------------------------

alter table app.organizations
  add column suspended_at timestamptz,
  add column suspension_reason text check (char_length(suspension_reason) between 1 and 500);

-- A shop suspended before this migration gets a date and a reason.
update app.organizations
   set suspended_at = updated_at,
       suspension_reason = 'Suspendue avant l’administration de la plateforme.'
 where status = 'suspended';

alter table app.organizations
  add constraint organizations_suspension_check
    check ((status = 'suspended') = (suspended_at is not null and suspension_reason is not null));

-- ---------------------------------------------------------------------------
-- Requests to change offer: decided by the platform
-- ---------------------------------------------------------------------------

alter table app.plan_change_requests drop constraint plan_change_requests_status_check;
alter table app.plan_change_requests
  add constraint plan_change_requests_status_check
  check (status in ('pending', 'cancelled', 'done', 'rejected')),
  add column resolution_note text not null default '' check (char_length(resolution_note) <= 500);

-- The platform changes an offer through the API (the guard checks it is an
-- administrator); the trigger still copies the offer's limits.
grant update (plan_key, changed_by) on app.subscriptions to nagaw_api;
create policy api_change on app.subscriptions
  for update to nagaw_api using (true) with check (true);

-- ---------------------------------------------------------------------------
-- What devices send (synchronization metrics)
-- ---------------------------------------------------------------------------

create table app.sync_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  device_id uuid not null,
  user_id uuid not null references app.user_profiles (id) on delete restrict,
  accepted integer not null check (accepted >= 0),
  duplicates integer not null check (duplicates >= 0),
  rejected integer not null check (rejected >= 0),
  received_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, device_id)
    references app.devices (organization_id, id) on delete restrict
);

create index sync_batches_received_idx on app.sync_batches (received_at desc);
create index sync_batches_org_idx on app.sync_batches (organization_id, received_at desc);
create index sync_batches_device_idx on app.sync_batches (organization_id, device_id);
create index sync_batches_user_idx on app.sync_batches (user_id);

create table app.sync_rejections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  batch_id uuid not null,
  client_operation_id uuid not null,
  operation_type text not null check (operation_type in ('sale', 'customer')),
  code text not null check (char_length(code) between 1 and 60),
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now(),
  foreign key (organization_id, batch_id)
    references app.sync_batches (organization_id, id) on delete restrict
);

create index sync_rejections_batch_idx on app.sync_rejections (organization_id, batch_id);
create index sync_rejections_created_idx on app.sync_rejections (created_at desc);

create trigger sync_batches_no_update_delete
  before update or delete on app.sync_batches
  for each row execute function app.reject_append_only_mutation();
create trigger sync_rejections_no_update_delete
  before update or delete on app.sync_rejections
  for each row execute function app.reject_append_only_mutation();
create trigger sync_batches_no_truncate
  before truncate on app.sync_batches
  for each statement execute function app.reject_append_only_mutation();
create trigger sync_rejections_no_truncate
  before truncate on app.sync_rejections
  for each statement execute function app.reject_append_only_mutation();

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on app.platform_admins, app.platform_settings, app.sync_batches, app.sync_rejections from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.platform_admins, app.platform_settings, app.sync_batches, app.sync_rejections from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.platform_admins, app.platform_settings, app.sync_batches, app.sync_rejections from authenticated';
  end if;
end
$$;

-- Read only: administrators and thresholds are set in SQL.
grant select on app.platform_admins, app.platform_settings to nagaw_api;
grant select, insert on app.sync_batches, app.sync_rejections to nagaw_api;

alter table app.platform_admins enable row level security;
alter table app.platform_settings enable row level security;
alter table app.sync_batches enable row level security;
alter table app.sync_rejections enable row level security;

create policy api_read on app.platform_admins for select to nagaw_api using (true);
create policy api_read on app.platform_settings for select to nagaw_api using (true);
create policy api_read on app.sync_batches for select to nagaw_api using (true);
create policy api_append on app.sync_batches for insert to nagaw_api with check (true);
create policy api_read on app.sync_rejections for select to nagaw_api using (true);
create policy api_append on app.sync_rejections for insert to nagaw_api with check (true);
