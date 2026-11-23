-- Customer orders, phase 1 (ADR-072): a sale promised for later. The
-- customer chooses today, pays everything, a deposit or nothing, and gets
-- the order later; at the handover it becomes an ordinary sale.
--
-- Off for every shop until the merchant turns it on (Mon application).

alter table app.organizations
  add column orders_enabled boolean not null default false,
  -- A ready order not collected after this many days is recalled.
  add column order_ready_reminder_days integer not null default 7
    check (order_ready_reminder_days between 1 and 90);

-- Order numbers come from the same locked sequences as the documents.
alter table app.document_sequences
  drop constraint document_sequences_kind_check,
  add constraint document_sequences_kind_check
    check (kind in ('quote', 'invoice', 'credit_note', 'expense', 'order'));

-- A deposit already counted in the money when it was received: copied on
-- the sale of the handover, it is not counted a second time.
alter table app.sale_payments
  add column from_order boolean not null default false;

create table app.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  number text not null check (number ~ '^C-[0-9]{4}-[0-9]{4,}$'),
  customer_id uuid not null,
  status text not null default 'received'
    check (status in ('received', 'in_preparation', 'ready', 'out_for_delivery',
                      'delivered', 'cancelled')),
  -- [{ productId, label, unit, quantity, unitPrice, lineTotal, note }]:
  -- prices frozen when the order is taken.
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 100),
  items_total bigint not null check (items_total >= 0),
  due_on date not null,
  due_time time,
  fulfilment text not null check (fulfilment in ('pickup', 'delivery')),
  delivery_address text not null default '' check (char_length(delivery_address) <= 200),
  delivery_landmark text not null default '' check (char_length(delivery_landmark) <= 200),
  delivery_phone text not null default '' check (char_length(delivery_phone) <= 30),
  delivery_fee bigint not null default 0 check (delivery_fee >= 0),
  note text not null default '' check (char_length(note) <= 500),
  sale_id uuid,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references app.user_profiles (id) on delete restrict,
  cancellation_reason text check (char_length(cancellation_reason) between 1 and 300),
  client_operation_id uuid not null,
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, number),
  unique (organization_id, client_operation_id),
  check (fulfilment = 'delivery' or (delivery_fee = 0 and status <> 'out_for_delivery')),
  check ((status = 'delivered') = (sale_id is not null and delivered_at is not null)),
  check ((status = 'cancelled') = (cancelled_at is not null and cancelled_by is not null
                                   and cancellation_reason is not null)),
  foreign key (organization_id, customer_id)
    references app.customers (organization_id, id) on delete restrict,
  foreign key (organization_id, sale_id)
    references app.sales (organization_id, id) on delete restrict
);

create index orders_org_status_due_idx on app.orders (organization_id, status, due_on);
create index orders_customer_idx on app.orders (organization_id, customer_id);
create index orders_created_by_idx on app.orders (created_by);
create index orders_cancelled_by_idx on app.orders (cancelled_by);
create unique index orders_sale_key on app.orders (organization_id, sale_id) where sale_id is not null;

create trigger orders_set_updated_at
  before update on app.orders
  for each row execute function app.set_updated_at();

-- Deposits and their refund: money in, money out, never changed.
create table app.order_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  order_id uuid not null,
  kind text not null check (kind in ('deposit', 'refund')),
  method text not null check (method in ('cash', 'mobile_money', 'card')),
  provider text check (provider in ('wave', 'orange_money', 'free_money', 'other')),
  reference text check (char_length(reference) between 1 and 60),
  amount bigint not null check (amount > 0),
  client_operation_id uuid not null,
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((method = 'mobile_money') = (provider is not null)),
  unique (organization_id, client_operation_id),
  foreign key (organization_id, order_id)
    references app.orders (organization_id, id) on delete restrict
);

create index order_payments_order_idx on app.order_payments (organization_id, order_id);
create index order_payments_created_by_idx on app.order_payments (created_by);

create trigger order_payments_no_update_delete
  before update or delete on app.order_payments
  for each row execute function app.reject_append_only_mutation();
create trigger order_payments_no_truncate
  before truncate on app.order_payments
  for each statement execute function app.reject_append_only_mutation();

revoke all on app.orders, app.order_payments from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.orders, app.order_payments from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.orders, app.order_payments from authenticated';
  end if;
end
$$;

grant select, insert, update on app.orders to nagaw_api;
grant select, insert on app.order_payments to nagaw_api;

alter table app.orders enable row level security;
alter table app.order_payments enable row level security;

create policy api_access on app.orders
  for all to nagaw_api using (true) with check (true);
create policy api_read on app.order_payments for select to nagaw_api using (true);
create policy api_append on app.order_payments for insert to nagaw_api with check (true);
