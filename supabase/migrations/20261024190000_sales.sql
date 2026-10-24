-- Phase 10 — sales at the counter (ADR-024).
--
-- A sale is recorded once and never edited: its lines and payments are
-- append-only, and the only change allowed afterwards is its cancellation
-- (by a manager, with a reason), which puts the goods back in stock. Prices
-- and totals are computed by the API from the catalogue, never trusted from
-- the device. Customers can buy on credit; what they owe is the credit of
-- their completed sales minus what they paid back.

-- ---------------------------------------------------------------------------
-- Settings and caps, per organization (never hard-coded)
-- ---------------------------------------------------------------------------

alter table app.organizations
  -- Largest discount a seller (member) may give on a sale; managers: any.
  add column seller_max_discount_basis_points integer not null default 1000
    check (seller_max_discount_basis_points between 0 and 10000),
  add column max_customers integer not null default 5000
    check (max_customers between 1 and 100000),
  -- Next ticket number, taken under the organization lock.
  add column next_sale_number integer not null default 1
    check (next_sale_number >= 1);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

create table app.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
  phone text not null default '' check (char_length(phone) <= 30),
  notes text not null default '' check (char_length(notes) <= 1000),
  -- Most a customer may owe; null: no limit.
  credit_limit bigint check (credit_limit between 0 and 1000000000000),
  status text not null default 'active' check (status in ('active', 'archived')),
  client_operation_id uuid not null,
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, client_operation_id)
);

create index customers_org_name_idx on app.customers (organization_id, lower(name));
create index customers_created_by_idx on app.customers (created_by);

create trigger customers_set_updated_at
  before update on app.customers
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------------

create table app.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  sale_number integer not null check (sale_number >= 1),
  customer_id uuid,
  seller_id uuid not null,
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  subtotal bigint not null check (subtotal between 0 and 1000000000000),
  discount bigint not null default 0 check (discount >= 0 and discount <= subtotal),
  total bigint not null check (total = subtotal - discount),
  tax_total bigint not null check (tax_total between 0 and total),
  -- Cash handed over by the customer and change given back.
  cash_received bigint check (cash_received >= 0),
  change_given bigint check (change_given >= 0),
  client_operation_id uuid not null,
  occurred_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references app.user_profiles (id) on delete restrict,
  cancel_reason text check (char_length(cancel_reason) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, sale_number),
  unique (organization_id, client_operation_id),
  check ((cash_received is null) = (change_given is null)),
  check (
    (status = 'cancelled')
    = (cancelled_at is not null and cancelled_by is not null and cancel_reason is not null)
  ),
  foreign key (organization_id, customer_id)
    references app.customers (organization_id, id) on delete restrict,
  foreign key (organization_id, seller_id)
    references app.organization_memberships (organization_id, user_id) on delete restrict
);

create index sales_org_occurred_idx on app.sales (organization_id, occurred_at desc);
create index sales_customer_idx on app.sales (organization_id, customer_id) where customer_id is not null;
create index sales_seller_idx on app.sales (organization_id, seller_id, occurred_at desc);
create index sales_cancelled_by_idx on app.sales (cancelled_by) where cancelled_by is not null;

-- The only change allowed: completed → cancelled, with its three fields.
create or replace function app.sales_only_cancellation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'sales are never deleted' using errcode = 'insufficient_privilege';
  end if;
  if old.status <> 'completed' or new.status <> 'cancelled'
     or (to_jsonb(new) - array['status', 'cancelled_at', 'cancelled_by', 'cancel_reason'])
        is distinct from (to_jsonb(old) - array['status', 'cancelled_at', 'cancelled_by', 'cancel_reason'])
  then
    raise exception 'a sale can only be cancelled' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger sales_only_cancellation
  before update or delete on app.sales
  for each row execute function app.sales_only_cancellation();

create trigger sales_no_truncate
  before truncate on app.sales
  for each statement execute function app.reject_append_only_mutation();

create table app.sale_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  sale_id uuid not null,
  position integer not null check (position between 1 and 200),
  product_id uuid not null,
  -- Copied from the catalogue at the time of the sale.
  label text not null check (char_length(label) between 1 and 120),
  unit text not null,
  unit_price bigint not null check (unit_price between 0 and 1000000000000),
  quantity numeric(14, 3) not null check (quantity > 0),
  line_total bigint not null check (line_total >= 0),
  tax_rate_basis_points integer check (tax_rate_basis_points between 0 and 10000),
  tax_amount bigint not null default 0 check (tax_amount >= 0),
  unique (sale_id, position),
  foreign key (organization_id, sale_id)
    references app.sales (organization_id, id) on delete restrict,
  foreign key (organization_id, product_id)
    references app.products (organization_id, id) on delete restrict
);

create index sale_lines_product_idx on app.sale_lines (organization_id, product_id);

create table app.sale_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  sale_id uuid not null,
  method text not null check (method in ('cash', 'mobile_money', 'card', 'credit')),
  provider text check (provider in ('wave', 'orange_money', 'free_money', 'other')),
  reference text check (char_length(reference) between 1 and 60),
  amount bigint not null check (amount > 0),
  check ((method = 'mobile_money') = (provider is not null)),
  foreign key (organization_id, sale_id)
    references app.sales (organization_id, id) on delete restrict
);

create index sale_payments_sale_idx on app.sale_payments (sale_id);

-- Money a customer pays back on what they owe.
create table app.customer_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  customer_id uuid not null,
  method text not null check (method in ('cash', 'mobile_money', 'card')),
  provider text check (provider in ('wave', 'orange_money', 'free_money', 'other')),
  reference text check (char_length(reference) between 1 and 60),
  amount bigint not null check (amount > 0),
  client_operation_id uuid not null,
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  check ((method = 'mobile_money') = (provider is not null)),
  foreign key (organization_id, customer_id)
    references app.customers (organization_id, id) on delete restrict
);

create index customer_payments_customer_idx
  on app.customer_payments (organization_id, customer_id, created_at desc);
create index customer_payments_created_by_idx on app.customer_payments (created_by);

-- Lines, payments and repayments are never changed.
create trigger sale_lines_no_update_delete
  before update or delete on app.sale_lines
  for each row execute function app.reject_append_only_mutation();
create trigger sale_lines_no_truncate
  before truncate on app.sale_lines
  for each statement execute function app.reject_append_only_mutation();
create trigger sale_payments_no_update_delete
  before update or delete on app.sale_payments
  for each row execute function app.reject_append_only_mutation();
create trigger sale_payments_no_truncate
  before truncate on app.sale_payments
  for each statement execute function app.reject_append_only_mutation();
create trigger customer_payments_no_update_delete
  before update or delete on app.customer_payments
  for each row execute function app.reject_append_only_mutation();
create trigger customer_payments_no_truncate
  before truncate on app.customer_payments
  for each statement execute function app.reject_append_only_mutation();

-- ---------------------------------------------------------------------------
-- Stock movements of a sale
-- ---------------------------------------------------------------------------

alter table app.stock_movements
  add column sale_id uuid,
  add constraint stock_movements_sale_fkey foreign key (organization_id, sale_id)
    references app.sales (organization_id, id) on delete restrict,
  -- Sales and their returns always point to the sale.
  add constraint stock_movements_sale_link_check
    check ((kind in ('sale', 'return')) = (sale_id is not null));

create index stock_movements_sale_idx
  on app.stock_movements (organization_id, sale_id) where sale_id is not null;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on app.customers, app.sales, app.sale_lines, app.sale_payments,
  app.customer_payments from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.customers, app.sales, app.sale_lines,
      app.sale_payments, app.customer_payments from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.customers, app.sales, app.sale_lines,
      app.sale_payments, app.customer_payments from authenticated';
  end if;
end
$$;

grant select, insert, update on app.customers to nagaw_api;
-- UPDATE on sales is limited to the cancellation by the trigger above.
grant select, insert, update on app.sales to nagaw_api;
grant select, insert on app.sale_lines, app.sale_payments, app.customer_payments
  to nagaw_api;

alter table app.customers enable row level security;
alter table app.sales enable row level security;
alter table app.sale_lines enable row level security;
alter table app.sale_payments enable row level security;
alter table app.customer_payments enable row level security;

create policy api_access on app.customers
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.sales
  for all to nagaw_api using (true) with check (true);
create policy api_read on app.sale_lines for select to nagaw_api using (true);
create policy api_append on app.sale_lines for insert to nagaw_api with check (true);
create policy api_read on app.sale_payments for select to nagaw_api using (true);
create policy api_append on app.sale_payments for insert to nagaw_api with check (true);
create policy api_read on app.customer_payments for select to nagaw_api using (true);
create policy api_append on app.customer_payments
  for insert to nagaw_api with check (true);
