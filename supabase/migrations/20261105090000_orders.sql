-- Catalogue in a link and orders from a distance (ADR-063, Phase 20).
--
-- The shop shares /b/{slug}; a customer without an account picks products
-- and orders. The order arrives in the application; the seller confirms it,
-- records the payment, hands it to a courier and marks it delivered, which
-- turns it into a sale (ADR-024) under the operation id chosen here.

-- « Commandes » is a module of the menu (ADR-062). It opens a public page,
-- so it starts hidden for every shop: the shop shows it, then publishes.
alter table app.organizations
  drop constraint organizations_hidden_modules_check;
alter table app.organizations
  add constraint organizations_hidden_modules_check
    check (hidden_modules <@ array['documents', 'suppliers', 'expenses', 'stats', 'accounting', 'orders']::text[]);
update app.organizations
   set hidden_modules = array_append(hidden_modules, 'orders')
 where not ('orders' = any (hidden_modules));
alter table app.organizations alter column hidden_modules set default '{orders}';

alter table app.profile_choices drop constraint profile_choices_modules_check;
alter table app.profile_choices
  add constraint profile_choices_modules_check
    check (modules <@ array['documents', 'suppliers', 'expenses', 'stats', 'accounting', 'orders']::text[]);
insert into app.profile_choices (kind, key, label, position, modules) values
  ('goal', 'orders', 'Prendre des commandes à distance', 45, array['orders']);

-- What the public page shows and where the customer pays (ADR-056 model:
-- the number and a reference, checked by hand).
alter table app.organizations
  add column catalog_published boolean not null default false,
  add column order_wave_number text not null default ''
    check (order_wave_number ~ '^[0-9 ]{0,20}$'),
  add column order_orange_money_number text not null default ''
    check (order_orange_money_number ~ '^[0-9 ]{0,20}$'),
  add column order_note text not null default ''
    check (char_length(order_note) <= 300);

-- A product leaves the public catalogue without leaving the shop.
alter table app.products add column sold_online boolean not null default true;

-- Orders a free shop receives in a month; null: no limit (owner's choice
-- of the plan, 2026-11-04: 30 in Gratuit).
alter table app.plans add column max_orders_per_month integer
  check (max_orders_per_month is null or max_orders_per_month >= 0);
update app.plans set max_orders_per_month = 30 where key = 'free';

-- Limits of the public form, in the database (CLAUDE.md).
alter table app.platform_settings
  add column public_orders_per_phone_per_hour integer not null default 5
    check (public_orders_per_phone_per_hour between 1 and 1000),
  add column public_orders_per_shop_per_hour integer not null default 120
    check (public_orders_per_shop_per_hour between 1 and 100000);

create table app.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  -- Shown to the customer and written with the payment: CMD-XXXXXX.
  reference text not null check (reference ~ '^CMD-[0-9A-Z]{6}$'),
  status text not null default 'new'
    check (status in ('new', 'confirmed', 'shipping', 'delivered', 'cancelled')),
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  -- International digits, as the phone sign-in keeps them (ADR-058).
  customer_phone text not null check (customer_phone ~ '^[1-9][0-9]{7,14}$'),
  customer_area text not null check (char_length(customer_area) between 2 and 160),
  customer_note text not null default '' check (char_length(customer_note) <= 500),
  -- Total of the lines at the prices shown to the customer.
  total bigint not null check (total >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- Paid to the courier, outside the sale.
  delivery_fee bigint not null default 0 check (delivery_fee >= 0),
  courier_name text not null default '' check (char_length(courier_name) <= 120),
  courier_phone text not null default '' check (courier_phone ~ '^([1-9][0-9]{7,14})?$'),
  paid_at timestamptz,
  payment_method text check (payment_method in ('cash', 'mobile_money')),
  payment_provider text,
  payment_reference text not null default '' check (char_length(payment_reference) <= 60),
  cancel_reason text not null default '' check (char_length(cancel_reason) <= 500),
  -- The sale made at delivery, under this operation id (ADR-020).
  sale_operation_id uuid not null default gen_random_uuid(),
  sale_id uuid,
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  updated_by uuid references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, reference),
  unique (organization_id, sale_operation_id),
  foreign key (organization_id, sale_id) references app.sales (organization_id, id) on delete restrict,
  check ((paid_at is null) = (payment_method is null)),
  check ((payment_method = 'mobile_money') = (payment_provider is not null)),
  check ((status = 'delivered') = (sale_id is not null)),
  check (status <> 'delivered' or paid_at is not null),
  check (status <> 'cancelled' or char_length(cancel_reason) > 0)
);

create index orders_list_idx on app.orders (organization_id, created_at desc);
create index orders_status_idx on app.orders (organization_id, status);
-- The public form counts the recent orders of a phone.
create index orders_phone_idx on app.orders (customer_phone, created_at desc);

create trigger orders_set_updated_at
  before update on app.orders
  for each row execute function app.set_updated_at();

create table app.order_lines (
  organization_id uuid not null,
  order_id uuid not null,
  position integer not null check (position >= 0),
  product_id uuid not null,
  label text not null,
  unit_price bigint not null check (unit_price >= 0),
  quantity numeric(14, 3) not null check (quantity > 0),
  line_total bigint not null check (line_total >= 0),
  primary key (organization_id, order_id, position),
  foreign key (organization_id, order_id)
    references app.orders (organization_id, id) on delete restrict,
  foreign key (organization_id, product_id)
    references app.products (organization_id, id) on delete restrict
);

revoke all on app.orders, app.order_lines from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.orders, app.order_lines from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.orders, app.order_lines from authenticated';
  end if;
end
$$;

-- No delete, as everywhere in `app`: a cancelled order stays, with its reason.
grant select, insert, update on app.orders to nagaw_api;
grant select, insert on app.order_lines to nagaw_api;

alter table app.orders enable row level security;
create policy api_access on app.orders
  for all to nagaw_api using (true) with check (true);
alter table app.order_lines enable row level security;
create policy api_access on app.order_lines
  for all to nagaw_api using (true) with check (true);
