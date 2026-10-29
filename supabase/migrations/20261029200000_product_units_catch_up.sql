-- Brings every database to the final state of 20261028090000_product_units
-- (ADR-038, ADR-043).
--
-- That migration was applied to production in its first version, then
-- completed in the same file before being merged (step 2: computed prices,
-- conversions, shop templates). Production therefore lacks what step 2
-- added, and every sale failed on `sale_lines.price_basis`. A merged
-- migration is never edited again: this one adds what is missing, and does
-- nothing on a database that already has it (every statement is guarded).

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

alter table app.organizations
  add column if not exists max_unit_templates integer not null default 50
    check (max_unit_templates between 1 and 500);

-- Production already dropped it (first version of the migration): only
-- the databases that still have it get the comment. Nothing reads it, and
-- the migration that drops it must use `if exists`.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'app' and table_name = 'organizations'
       and column_name = 'seller_max_discount_basis_points'
  ) then
    comment on column app.organizations.seller_max_discount_basis_points is
      'Unused since ADR-038; to be dropped by a later migration.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Unit templates of the shop
-- ---------------------------------------------------------------------------

create table if not exists app.unit_templates (
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

create unique index if not exists unit_templates_org_label_active_key
  on app.unit_templates (organization_id, stock_unit, lower(label)) where status = 'active';
create index if not exists unit_templates_created_by_idx on app.unit_templates (created_by);

drop trigger if exists unit_templates_set_updated_at on app.unit_templates;
create trigger unit_templates_set_updated_at
  before update on app.unit_templates
  for each row execute function app.set_updated_at();

revoke all on app.unit_templates from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.unit_templates from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.unit_templates from authenticated';
  end if;
end
$$;

grant select, insert, update on app.unit_templates to nagaw_api;
alter table app.unit_templates enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'app' and tablename = 'unit_templates' and policyname = 'api_access'
  ) then
    create policy api_access on app.unit_templates
      for all to nagaw_api using (true) with check (true);
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Selling units: the price may be computed from the stock unit
-- ---------------------------------------------------------------------------

-- Null: the price of the stock unit × the quantity taken from the stock.
alter table app.product_units alter column sale_price drop not null;

-- ---------------------------------------------------------------------------
-- Sale lines
-- ---------------------------------------------------------------------------

-- `unit`: unit_price is the price of one unit sold; `stock`: it is the
-- price of one stock unit, applied to base_quantity (« 250 g »). Existing
-- lines were all priced per unit sold.
alter table app.sale_lines
  add column if not exists price_basis text not null default 'unit'
    check (price_basis in ('unit', 'stock'));

-- A conversion (« g » of a product counted in kg) has a unit name without
-- a selling unit; every existing line satisfies the new rule.
alter table app.sale_lines drop constraint if exists sale_lines_unit_check;
alter table app.sale_lines
  add constraint sale_lines_unit_check
    check ((product_unit_id is null or unit_label is not null)
       and (unit_label is not null or (unit_factor = 1 and price_basis = 'unit')));

comment on column app.sale_lines.unit_cost is
  'Purchase price of one stock unit at the time of the sale (× base_quantity).';
