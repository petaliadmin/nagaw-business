-- Limits of an offer set from the administration (ADR-075).
--
-- Besides products, people and cash phones (ADR-029), an offer limits the
-- sales, invoices and quotes of a month, the customers and suppliers, the
-- months of history shown, and the modules it includes. Empty: no limit.
-- Nothing is removed: everything starts empty and with every module, so
-- that no shop loses anything; the owner sets the grid in « Offres ».

alter table app.plans
  add column max_sales_per_month integer check (max_sales_per_month between 1 and 10000000),
  add column max_invoices_per_month integer check (max_invoices_per_month between 1 and 1000000),
  add column max_quotes_per_month integer check (max_quotes_per_month between 1 and 1000000),
  add column max_customers integer check (max_customers between 1 and 100000),
  add column max_suppliers integer check (max_suppliers between 1 and 10000),
  add column history_months integer check (history_months between 3 and 120),
  add column modules text[] not null
    default array['accounting', 'treasury', 'orders', 'statistics']
    check (modules <@ array['accounting', 'treasury', 'orders', 'statistics']),
  -- Who last changed the offer from the administration; null: a migration.
  add column updated_by uuid references app.user_profiles (id) on delete restrict;

create index plans_updated_by_idx on app.plans (updated_by) where updated_by is not null;

-- The platform changes prices and limits; never the key, the name or the order.
grant update (monthly_price, yearly_price, max_products, max_members, max_devices,
              max_sales_per_month, max_invoices_per_month, max_quotes_per_month,
              max_customers, max_suppliers, history_months, modules, updated_by)
  on app.plans to nagaw_api;

create policy api_update on app.plans
  for update to nagaw_api using (true) with check (true);

-- A cap changed on an offer applies at once to the shops of this offer, as
-- when a shop changes offer (`apply_subscription_plan`). What they already
-- have stays: only what is added beyond the cap is refused.
create or replace function app.apply_plan_caps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update app.organizations o
     set max_products = new.max_products,
         max_members = new.max_members,
         max_devices = new.max_devices
    from app.subscriptions s
   where s.plan_key = new.key and o.id = s.organization_id;
  return new;
end;
$$;

create trigger plans_apply_caps
  after update of max_products, max_members, max_devices on app.plans
  for each row
  when (old.max_products is distinct from new.max_products
        or old.max_members is distinct from new.max_members
        or old.max_devices is distinct from new.max_devices)
  execute function app.apply_plan_caps();

-- What each change of an offer was: before, after, who and when.
create table app.plan_revisions (
  id bigint generated always as identity primary key,
  plan_key text not null references app.plans (key) on delete restrict,
  changed_by uuid not null references app.user_profiles (id) on delete restrict,
  before jsonb not null,
  after jsonb not null,
  created_at timestamptz not null default now()
);

create index plan_revisions_plan_idx on app.plan_revisions (plan_key, id desc);
create index plan_revisions_changed_by_idx on app.plan_revisions (changed_by);

create trigger plan_revisions_append_only
  before update or delete on app.plan_revisions
  for each row execute function app.reject_append_only_mutation();

revoke all on app.plan_revisions from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.plan_revisions from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.plan_revisions from authenticated';
  end if;
end
$$;

grant select, insert on app.plan_revisions to nagaw_api;

alter table app.plan_revisions enable row level security;

create policy api_read on app.plan_revisions for select to nagaw_api using (true);
create policy api_append on app.plan_revisions for insert to nagaw_api with check (true);
