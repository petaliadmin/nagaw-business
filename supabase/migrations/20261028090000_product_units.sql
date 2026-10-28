-- Selling units and negotiated prices (ADR-038).
--
-- A product keeps one stock unit (`products.unit`, its price and barcode):
-- the stock, the inventory and the purchase price are counted in it. It is
-- also sold in other units:
--   - standard conversions, offered without anything to record (kg ↔ g,
--     m → cm, L → cl, ml), priced from the stock unit (code in
--     packages/shared, never stored here);
--   - selling units of the product (« sac de 50 kg », « paquet de 20 »),
--     worth a fixed number of stock units, with their own price or priced
--     from the stock unit when none is set. The number never changes once
--     created: a sale recorded offline with « sac = 50 kg » is converted on
--     arrival with the same number;
--   - unit templates of the shop, copied into a product's selling units.
--
-- A sale line keeps the catalogue price and, when the seller and the
-- customer agreed on another amount, what was really paid.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

alter table app.organizations
  add column max_product_units integer not null default 10
    check (max_product_units between 1 and 50),
  add column max_unit_templates integer not null default 50
    check (max_unit_templates between 1 and 500),
  -- Whether a seller (member) may sell under the purchase price.
  add column seller_can_sell_below_cost boolean not null default false;

-- The limit is now set seller by seller (organization_memberships):
-- `seller_max_discount_basis_points` is no longer read. It stays until the
-- previous API is gone (two-step deployment), then a later migration drops it.
comment on column app.organizations.seller_max_discount_basis_points is
  'Unused since ADR-038; to be dropped by a later migration.';

-- Largest reduction (negotiated prices and discount) this person may give,
-- in basis points of the catalogue amount; null: no limit.
alter table app.organization_memberships
  add column max_discount_basis_points integer
    check (max_discount_basis_points between 0 and 10000);

-- ---------------------------------------------------------------------------
-- Unit templates of the shop
-- ---------------------------------------------------------------------------

create table app.unit_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  label text not null check (label = btrim(label) and char_length(label) between 1 and 60),
  -- Stock unit of the products it fits (same list as products.unit).
  stock_unit text not null
    check (stock_unit in ('piece', 'carton', 'paquet', 'sachet', 'bouteille', 'sac', 'kg', 'g', 'litre', 'ml', 'metre')),
  factor numeric(14, 3) not null check (factor > 0),
  allows_decimals boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  client_operation_id uuid not null,
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, client_operation_id)
);

create unique index unit_templates_org_label_active_key
  on app.unit_templates (organization_id, stock_unit, lower(label)) where status = 'active';
create index unit_templates_created_by_idx on app.unit_templates (created_by);

create trigger unit_templates_set_updated_at
  before update on app.unit_templates
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Selling units
-- ---------------------------------------------------------------------------

create table app.product_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  product_id uuid not null,
  label text not null check (label = btrim(label) and char_length(label) between 1 and 60),
  -- Stock units in one of this unit. Never changes (trigger below).
  factor numeric(14, 3) not null check (factor > 0),
  -- Price paid by the customer for one of this unit, taxes included;
  -- null: the price of the stock unit × the quantity taken from the stock.
  sale_price bigint check (sale_price between 0 and 1000000000000),
  -- « 1,5 » of this unit may be sold.
  allows_decimals boolean not null default false,
  barcode text check (barcode ~ '^[0-9A-Za-z-]{4,32}$'),
  status text not null default 'active' check (status in ('active', 'archived')),
  version integer not null default 1 check (version >= 1),
  client_operation_id uuid not null,
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, client_operation_id),
  foreign key (organization_id, product_id)
    references app.products (organization_id, id) on delete restrict
);

create unique index product_units_product_label_active_key
  on app.product_units (organization_id, product_id, lower(label)) where status = 'active';
create unique index product_units_org_barcode_active_key
  on app.product_units (organization_id, barcode) where status = 'active' and barcode is not null;
create index product_units_product_idx on app.product_units (organization_id, product_id);
create index product_units_created_by_idx on app.product_units (created_by);

create trigger product_units_set_updated_at
  before update on app.product_units
  for each row execute function app.set_updated_at();

create or replace function app.product_units_fixed_factor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.factor is distinct from old.factor
     or new.product_id is distinct from old.product_id then
    raise exception 'the factor of a selling unit never changes'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger product_units_fixed_factor
  before update on app.product_units
  for each row execute function app.product_units_fixed_factor();

-- ---------------------------------------------------------------------------
-- Sale lines
-- ---------------------------------------------------------------------------

-- Existing lines were sold in the stock unit, at the catalogue price.
alter table app.sale_lines
  -- Selling unit of the product; null: the stock unit or a conversion.
  add column product_unit_id uuid,
  -- Name of the unit sold (« sac de 50 kg », « g »); null: the stock unit.
  add column unit_label text check (char_length(unit_label) between 1 and 60),
  add column unit_factor numeric(14, 3) not null default 1 check (unit_factor > 0),
  -- What left the stock, in the stock unit.
  add column base_quantity numeric(14, 3)
    generated always as (round(quantity * unit_factor, 3)) stored,
  -- `unit`: unit_price is the price of one unit sold; `stock`: it is the
  -- price of one stock unit, applied to base_quantity (« 250 g »).
  add column price_basis text not null default 'unit'
    check (price_basis in ('unit', 'stock')),
  -- Catalogue amount when the price was negotiated; null: the customer
  -- paid the catalogue amount (line_total).
  add column list_total bigint check (list_total between 0 and 1000000000000),
  add constraint sale_lines_unit_check
    check ((product_unit_id is null or unit_label is not null)
       and (unit_label is not null or (unit_factor = 1 and price_basis = 'unit'))),
  add constraint sale_lines_product_unit_fkey
    foreign key (organization_id, product_unit_id)
    references app.product_units (organization_id, id) on delete restrict;

-- The cost of a line is now always per stock unit (× base_quantity), so
-- that a gram can carry the cost of a kilo; existing lines already were.
comment on column app.sale_lines.unit_cost is
  'Purchase price of one stock unit at the time of the sale (× base_quantity).';

create index sale_lines_product_unit_idx
  on app.sale_lines (organization_id, product_unit_id) where product_unit_id is not null;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on app.product_units, app.unit_templates from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.product_units, app.unit_templates from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.product_units, app.unit_templates from authenticated';
  end if;
end
$$;

grant select, insert, update on app.product_units, app.unit_templates to nagaw_api;

alter table app.product_units enable row level security;
alter table app.unit_templates enable row level security;

create policy api_access on app.product_units
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.unit_templates
  for all to nagaw_api using (true) with check (true);
