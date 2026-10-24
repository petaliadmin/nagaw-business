-- Phase 9 — products and stock (ADR-019, ADR-020, ADR-023).
--
-- Catalogue of a shop (organization): tax rates, categories, suppliers,
-- products and their photo. Stock is never stored as a number to overwrite:
-- it is the sum of `stock_movements`, an append-only ledger. Every row
-- written from a device carries `client_operation_id`, the idempotency key
-- of offline synchronization (Phase 11).
--
-- Amounts are bigint in the minor unit of the shop's currency (XOF: none).
-- Quantities are numeric(14,3), for goods sold by weight or volume.

-- ---------------------------------------------------------------------------
-- Caps, configurable per organization (never hard-coded)
-- ---------------------------------------------------------------------------

alter table app.organizations
  add column max_products integer not null default 5000
    check (max_products between 1 and 100000),
  add column max_product_categories integer not null default 100
    check (max_product_categories between 1 and 1000),
  add column max_suppliers integer not null default 500
    check (max_suppliers between 1 and 10000),
  add column max_tax_rates integer not null default 20
    check (max_tax_rates between 1 and 100);

-- ---------------------------------------------------------------------------
-- Tax rates
-- ---------------------------------------------------------------------------

create table app.tax_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  -- 1800 = 18 %.
  rate_basis_points integer not null check (rate_basis_points between 0 and 10000),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index tax_rates_org_name_active_key
  on app.tax_rates (organization_id, lower(name)) where status = 'active';
create index tax_rates_created_by_idx on app.tax_rates (created_by);

create trigger tax_rates_set_updated_at
  before update on app.tax_rates
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Product categories
-- ---------------------------------------------------------------------------

create table app.product_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  color text not null default 'brand'
    check (color in ('brand', 'sales', 'stock', 'invoices', 'stats', 'accounting', 'warning', 'danger')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index product_categories_org_name_active_key
  on app.product_categories (organization_id, lower(name)) where status = 'active';
create index product_categories_created_by_idx on app.product_categories (created_by);

create trigger product_categories_set_updated_at
  before update on app.product_categories
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------

create table app.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
  phone text not null default '' check (char_length(phone) <= 30),
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index suppliers_org_name_active_key
  on app.suppliers (organization_id, lower(name)) where status = 'active';
create index suppliers_created_by_idx on app.suppliers (created_by);

create trigger suppliers_set_updated_at
  before update on app.suppliers
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

create table app.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
  category_id uuid,
  unit text not null
    check (unit in ('piece', 'carton', 'paquet', 'sachet', 'bouteille', 'sac', 'kg', 'g', 'litre', 'ml', 'metre')),
  -- Price paid by the customer, taxes included (ADR-023).
  sale_price bigint not null check (sale_price between 0 and 1000000000000),
  purchase_price bigint check (purchase_price between 0 and 1000000000000),
  tax_rate_id uuid,
  barcode text check (barcode ~ '^[0-9A-Za-z-]{4,32}$'),
  track_stock boolean not null default true,
  low_stock_threshold numeric(14, 3) check (low_stock_threshold >= 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  -- Optimistic concurrency between devices (ADR-020).
  version integer not null default 1 check (version >= 1),
  -- SHA-256 of the current photo, hex; null when there is none.
  photo_sha256 text check (photo_sha256 ~ '^[0-9a-f]{64}$'),
  -- Idempotency key of the creation: a replay returns the same product.
  client_operation_id uuid not null,
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, client_operation_id),
  foreign key (organization_id, category_id)
    references app.product_categories (organization_id, id) on delete restrict,
  foreign key (organization_id, tax_rate_id)
    references app.tax_rates (organization_id, id) on delete restrict
);

create unique index products_org_name_active_key
  on app.products (organization_id, lower(name)) where status = 'active';
create unique index products_org_barcode_active_key
  on app.products (organization_id, barcode) where status = 'active' and barcode is not null;
create index products_org_category_idx on app.products (organization_id, category_id);
create index products_tax_rate_idx on app.products (organization_id, tax_rate_id);
create index products_created_by_idx on app.products (created_by);

create trigger products_set_updated_at
  before update on app.products
  for each row execute function app.set_updated_at();

-- One photo per product, small and resized on the device (ADR-023).
create table app.product_photos (
  organization_id uuid not null,
  product_id uuid not null,
  content_type text not null check (content_type in ('image/webp', 'image/jpeg', 'image/png')),
  data bytea not null check (octet_length(data) between 1 and 524288),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  updated_by uuid not null references app.user_profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (organization_id, product_id),
  foreign key (organization_id, product_id)
    references app.products (organization_id, id) on delete restrict
);

create index product_photos_updated_by_idx on app.product_photos (updated_by);

-- ---------------------------------------------------------------------------
-- Stock movements (append-only ledger)
-- ---------------------------------------------------------------------------

create table app.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  product_id uuid not null,
  kind text not null
    check (kind in ('initial', 'purchase', 'sale', 'return', 'loss', 'inventory', 'adjustment')),
  -- Signed change of the stock.
  quantity numeric(14, 3) not null,
  -- What was counted, for an inventory.
  counted_quantity numeric(14, 3) check (counted_quantity >= 0),
  unit_cost bigint check (unit_cost between 0 and 1000000000000),
  supplier_id uuid,
  reason text check (char_length(reason) between 1 and 500),
  client_operation_id uuid not null,
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  check (
    case kind
      when 'initial' then quantity > 0
      when 'purchase' then quantity > 0
      when 'return' then quantity > 0
      when 'sale' then quantity < 0
      when 'loss' then quantity < 0
      when 'adjustment' then quantity <> 0
      else true
    end
  ),
  check ((kind = 'inventory') = (counted_quantity is not null)),
  check (kind not in ('loss', 'adjustment') or reason is not null),
  check (supplier_id is null or kind = 'purchase'),
  foreign key (organization_id, product_id)
    references app.products (organization_id, id) on delete restrict,
  foreign key (organization_id, supplier_id)
    references app.suppliers (organization_id, id) on delete restrict
);

create index stock_movements_product_idx
  on app.stock_movements (organization_id, product_id, created_at desc, id desc);
create index stock_movements_supplier_idx
  on app.stock_movements (organization_id, supplier_id) where supplier_id is not null;
create index stock_movements_created_by_idx on app.stock_movements (created_by);

create trigger stock_movements_no_update_delete
  before update or delete on app.stock_movements
  for each row execute function app.reject_append_only_mutation();

create trigger stock_movements_no_truncate
  before truncate on app.stock_movements
  for each statement execute function app.reject_append_only_mutation();

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on app.tax_rates, app.product_categories, app.suppliers,
  app.products, app.product_photos, app.stock_movements from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.tax_rates, app.product_categories, app.suppliers,
      app.products, app.product_photos, app.stock_movements from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.tax_rates, app.product_categories, app.suppliers,
      app.products, app.product_photos, app.stock_movements from authenticated';
  end if;
end
$$;

grant select, insert, update on app.tax_rates, app.product_categories,
  app.suppliers, app.products, app.product_photos to nagaw_api;
grant select, insert on app.stock_movements to nagaw_api;

alter table app.tax_rates enable row level security;
alter table app.product_categories enable row level security;
alter table app.suppliers enable row level security;
alter table app.products enable row level security;
alter table app.product_photos enable row level security;
alter table app.stock_movements enable row level security;

create policy api_access on app.tax_rates
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.product_categories
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.suppliers
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.products
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.product_photos
  for all to nagaw_api using (true) with check (true);
create policy api_read on app.stock_movements
  for select to nagaw_api using (true);
create policy api_append on app.stock_movements
  for insert to nagaw_api with check (true);
