-- Subscriptions with a term, renewed by hand or automatically (ADR-073).
--
-- A paid offer lasts one month, or one year if the shop chooses it. The
-- platform extends it by hand (payment received), or it renews itself at
-- its end: an invoice to pay is then issued, and the shop is suspended if
-- the platform has not marked it paid after `subscription_grace_days`.
-- A lifetime subscription, given by the platform administrator only, never
-- ends and is never invoiced. No payment is taken by the application.

alter table app.plans
  -- Null: twelve months at the monthly price.
  add column yearly_price bigint check (yearly_price between 0 and 100000000000);

alter table app.subscriptions
  add column period text not null default 'month' check (period in ('month', 'year')),
  -- Null: a free offer, or a lifetime subscription.
  add column current_period_end timestamptz,
  add column auto_renew boolean not null default true,
  add column lifetime boolean not null default false,
  add column lifetime_granted_by uuid references app.user_profiles (id) on delete restrict,
  add column lifetime_granted_at timestamptz,
  add constraint subscriptions_lifetime_shape
    check (not lifetime or (current_period_end is null and lifetime_granted_by is not null
                            and lifetime_granted_at is not null));

create index subscriptions_period_end_idx on app.subscriptions (current_period_end)
  where current_period_end is not null;
create index subscriptions_lifetime_granted_by_idx on app.subscriptions (lifetime_granted_by)
  where lifetime_granted_by is not null;

-- The shops already on a paid offer get one month from today.
update app.subscriptions s
   set current_period_end = now() + interval '1 month'
  from app.plans p
 where p.key = s.plan_key and p.monthly_price > 0;

-- The platform changes the term; the owner turns the renewal off or on.
grant update (period, current_period_end, auto_renew, lifetime, lifetime_granted_by,
              lifetime_granted_at) on app.subscriptions to nagaw_api;

alter table app.plan_change_requests
  add column period text not null default 'month' check (period in ('month', 'year'));

alter table app.platform_settings
  add column subscription_grace_days integer not null default 15
    check (subscription_grace_days between 1 and 90);

create table app.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  plan_key text not null references app.plans (key) on delete restrict,
  period text not null check (period in ('month', 'year')),
  amount bigint not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  period_start timestamptz not null,
  period_end timestamptz not null check (period_end > period_start),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  -- After this moment, unpaid, the shop is suspended.
  due_at timestamptz not null,
  -- Who issued it: null for the automatic renewal.
  issued_by uuid references app.user_profiles (id) on delete restrict,
  paid_at timestamptz,
  paid_by uuid references app.user_profiles (id) on delete restrict,
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'paid') = (paid_at is not null and paid_by is not null))
);

-- One invoice per period of a shop: the daily run may pass twice.
create unique index subscription_invoices_period_key
  on app.subscription_invoices (organization_id, period_start)
  where status <> 'cancelled';
create index subscription_invoices_pending_idx
  on app.subscription_invoices (due_at) where status = 'pending';
create index subscription_invoices_org_idx
  on app.subscription_invoices (organization_id, created_at desc);
create index subscription_invoices_plan_idx on app.subscription_invoices (plan_key);
create index subscription_invoices_issued_by_idx on app.subscription_invoices (issued_by)
  where issued_by is not null;
create index subscription_invoices_paid_by_idx on app.subscription_invoices (paid_by)
  where paid_by is not null;

create trigger subscription_invoices_set_updated_at
  before update on app.subscription_invoices
  for each row execute function app.set_updated_at();

-- A shop suspended for an unpaid invoice opens again when it is paid.
alter table app.organizations
  add column suspended_invoice_id uuid references app.subscription_invoices (id) on delete restrict;
create index organizations_suspended_invoice_idx on app.organizations (suspended_invoice_id)
  where suspended_invoice_id is not null;

revoke all on app.subscription_invoices from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.subscription_invoices from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.subscription_invoices from authenticated';
  end if;
end
$$;

grant select, insert, update on app.subscription_invoices to nagaw_api;

alter table app.subscription_invoices enable row level security;

create policy api_access on app.subscription_invoices
  for all to nagaw_api using (true) with check (true);
