-- Phase 15 — offers and quotas (ADR-029).
--
-- Each shop has a subscription to an offer. The offer's limits are copied
-- into the shop's caps (organizations.max_*), which the API already checks
-- on every creation: changing an offer never needs new checks in the code.
-- No payment provider yet: a change of offer is asked by the owner and
-- made by the platform.

-- ---------------------------------------------------------------------------
-- A cap on the people of a shop
-- ---------------------------------------------------------------------------

alter table app.organizations
  add column max_members integer not null default 20
    check (max_members between 1 and 1000);

-- ---------------------------------------------------------------------------
-- Offers
-- ---------------------------------------------------------------------------

create table app.plans (
  key text primary key check (key ~ '^[a-z_]{2,30}$'),
  name text not null check (char_length(name) between 1 and 40),
  -- Per month and per shop, in minor units of `currency`.
  monthly_price bigint not null check (monthly_price between 0 and 1000000000),
  currency text not null default 'XOF' check (currency ~ '^[A-Z]{3}$'),
  max_products integer not null check (max_products between 1 and 100000),
  max_members integer not null check (max_members between 1 and 1000),
  max_devices integer not null check (max_devices between 1 and 1000),
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_set_updated_at
  before update on app.plans
  for each row execute function app.set_updated_at();

-- Offer grid chosen by the owner on 2026-10-25; prices may change in base.
insert into app.plans (key, name, monthly_price, max_products, max_members, max_devices, position)
values
  ('free', 'Gratuit', 0, 50, 2, 1, 1),
  ('essential', 'Essentiel', 5000, 500, 5, 3, 2),
  ('pro', 'Pro', 15000, 5000, 20, 10, 3);

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------

create table app.subscriptions (
  organization_id uuid primary key references app.organizations (id) on delete restrict,
  plan_key text not null references app.plans (key) on delete restrict,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Null when the system set it (new shop, migration).
  changed_by uuid references app.user_profiles (id) on delete restrict
);

create index subscriptions_plan_idx on app.subscriptions (plan_key);
create index subscriptions_changed_by_idx on app.subscriptions (changed_by) where changed_by is not null;

create trigger subscriptions_set_updated_at
  before update on app.subscriptions
  for each row execute function app.set_updated_at();

-- The offer's limits become the shop's caps.
create or replace function app.apply_subscription_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update app.organizations o
     set max_products = p.max_products,
         max_members = p.max_members,
         max_devices = p.max_devices
    from app.plans p
   where p.key = new.plan_key and o.id = new.organization_id;
  return new;
end;
$$;

create trigger subscriptions_apply_plan
  after insert or update of plan_key on app.subscriptions
  for each row execute function app.apply_subscription_plan();

-- New shops start on the free offer.
create or replace function app.organizations_start_subscription()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into app.subscriptions (organization_id, plan_key) values (new.id, 'free');
  return new;
end;
$$;

create trigger organizations_start_subscription
  after insert on app.organizations
  for each row execute function app.organizations_start_subscription();

-- Shops created before offers existed keep at least what they had.
insert into app.subscriptions (organization_id, plan_key)
select id, 'pro' from app.organizations
on conflict (organization_id) do nothing;

-- ---------------------------------------------------------------------------
-- Requests to change offer (handled by the platform until payment exists)
-- ---------------------------------------------------------------------------

create table app.plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  plan_key text not null references app.plans (key) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'cancelled', 'done')),
  requested_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references app.user_profiles (id) on delete restrict,
  check ((status = 'pending') = (resolved_at is null))
);

create unique index plan_change_requests_one_pending_key
  on app.plan_change_requests (organization_id) where status = 'pending';
create index plan_change_requests_org_idx on app.plan_change_requests (organization_id, created_at desc);
create index plan_change_requests_plan_idx on app.plan_change_requests (plan_key);
create index plan_change_requests_requested_by_idx on app.plan_change_requests (requested_by);
create index plan_change_requests_resolved_by_idx on app.plan_change_requests (resolved_by) where resolved_by is not null;

create trigger plan_change_requests_no_delete
  before delete on app.plan_change_requests
  for each row execute function app.reject_append_only_mutation();

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on app.plans, app.subscriptions, app.plan_change_requests from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.plans, app.subscriptions, app.plan_change_requests from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.plans, app.subscriptions, app.plan_change_requests from authenticated';
  end if;
end
$$;

-- The API reads offers, starts subscriptions (new shop) and records requests;
-- changing an offer is a platform operation (Phase 16).
grant select on app.plans to nagaw_api;
grant select, insert on app.subscriptions to nagaw_api;
grant select, insert, update on app.plan_change_requests to nagaw_api;

alter table app.plans enable row level security;
alter table app.subscriptions enable row level security;
alter table app.plan_change_requests enable row level security;

create policy api_read on app.plans for select to nagaw_api using (true);
create policy api_read on app.subscriptions for select to nagaw_api using (true);
create policy api_start on app.subscriptions for insert to nagaw_api with check (true);
create policy api_access on app.plan_change_requests
  for all to nagaw_api using (true) with check (true);
