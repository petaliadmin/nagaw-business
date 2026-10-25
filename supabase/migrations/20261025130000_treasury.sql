-- Phase 13 — treasury and statistics (ADR-027).
--
-- The money a shop holds is spread over cash accounts (« caisses ») : the
-- cash drawer, one account per Mobile Money operator, the bank. Their
-- balance is never stored: it is computed from what already records money
-- (sale payments, repayments, invoice payments) plus what this migration
-- adds (expenses, transfers, cash counts). Everything here is append-only;
-- a mistaken expense is cancelled, with who, when and why.

-- ---------------------------------------------------------------------------
-- Cost of goods at the time of the sale, for the gross margin
-- ---------------------------------------------------------------------------

-- Null for lines sold before this migration or for products without a
-- purchase price: the margin says which share of sales it covers.
alter table app.sale_lines
  add column unit_cost bigint check (unit_cost between 0 and 1000000000000);

-- ---------------------------------------------------------------------------
-- Settings (never hard-coded)
-- ---------------------------------------------------------------------------

alter table app.organizations
  add column max_expense_categories integer not null default 50
    check (max_expense_categories between 1 and 500);

-- ---------------------------------------------------------------------------
-- Cash accounts
-- ---------------------------------------------------------------------------

create table app.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  -- Where a payment lands: cash → cash; Mobile Money → the account of its
  -- operator; card, transfer and cheque → bank.
  kind text not null check (kind in ('cash', 'mobile_money', 'bank')),
  provider text check (provider in ('wave', 'orange_money', 'free_money', 'other')),
  name text not null check (char_length(name) between 1 and 60),
  -- Money already there when the shop started using the application.
  opening_balance bigint not null default 0
    check (opening_balance between -1000000000000 and 1000000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique nulls not distinct (organization_id, kind, provider),
  check ((kind = 'mobile_money') = (provider is not null))
);

create trigger cash_accounts_set_updated_at
  before update on app.cash_accounts
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Expense categories, with their SYSCOHADA account (Phase 14)
-- ---------------------------------------------------------------------------

create table app.expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 60),
  account_code text not null check (account_code ~ '^[1-9][0-9]{1,7}$'),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index expense_categories_active_name_key
  on app.expense_categories (organization_id, lower(name)) where status = 'active';

create trigger expense_categories_set_updated_at
  before update on app.expense_categories
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------

create table app.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  category_id uuid not null,
  cash_account_id uuid not null,
  label text not null check (char_length(label) between 1 and 120),
  amount bigint not null check (amount between 1 and 1000000000000),
  occurred_on date not null,
  status text not null default 'recorded' check (status in ('recorded', 'cancelled')),
  cancelled_at timestamptz,
  cancelled_by uuid references app.user_profiles (id) on delete restrict,
  cancel_reason text check (char_length(cancel_reason) between 1 and 500),
  client_operation_id uuid not null,
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  check ((status = 'cancelled') = (cancelled_at is not null and cancelled_by is not null and cancel_reason is not null)),
  foreign key (organization_id, category_id)
    references app.expense_categories (organization_id, id) on delete restrict,
  foreign key (organization_id, cash_account_id)
    references app.cash_accounts (organization_id, id) on delete restrict
);

create index expenses_org_day_idx on app.expenses (organization_id, occurred_on desc);
create index expenses_category_idx on app.expenses (organization_id, category_id);
create index expenses_account_idx on app.expenses (organization_id, cash_account_id);
create index expenses_created_by_idx on app.expenses (created_by);
create index expenses_cancelled_by_idx on app.expenses (cancelled_by) where cancelled_by is not null;

-- An expense is only ever cancelled (its three fields), never edited.
create or replace function app.expenses_only_cancellation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'expenses are never deleted' using errcode = 'insufficient_privilege';
  end if;
  if old.status = 'recorded' and new.status = 'cancelled'
     and (to_jsonb(new) - array['status', 'cancelled_at', 'cancelled_by', 'cancel_reason'])
         is not distinct from
         (to_jsonb(old) - array['status', 'cancelled_at', 'cancelled_by', 'cancel_reason'])
  then
    return new;
  end if;
  raise exception 'an expense can only be cancelled' using errcode = 'insufficient_privilege';
end;
$$;

create trigger expenses_only_cancellation
  before update or delete on app.expenses
  for each row execute function app.expenses_only_cancellation();

-- ---------------------------------------------------------------------------
-- Transfers between accounts (cash taken to the bank, Wave withdrawn…)
-- ---------------------------------------------------------------------------

create table app.cash_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  from_account_id uuid not null,
  to_account_id uuid not null,
  amount bigint not null check (amount between 1 and 1000000000000),
  occurred_on date not null,
  note text not null default '' check (char_length(note) <= 200),
  client_operation_id uuid not null,
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  check (from_account_id <> to_account_id),
  foreign key (organization_id, from_account_id)
    references app.cash_accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, to_account_id)
    references app.cash_accounts (organization_id, id) on delete restrict
);

create index cash_transfers_org_day_idx on app.cash_transfers (organization_id, occurred_on desc);
create index cash_transfers_from_idx on app.cash_transfers (organization_id, from_account_id);
create index cash_transfers_to_idx on app.cash_transfers (organization_id, to_account_id);
create index cash_transfers_created_by_idx on app.cash_transfers (created_by);

-- ---------------------------------------------------------------------------
-- Cash counts (« clôture de caisse »)
-- ---------------------------------------------------------------------------

-- The counted amount becomes the truth: the difference is a movement of
-- the day, so that the next day starts from what was really there.
create table app.cash_closings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  cash_account_id uuid not null,
  day date not null,
  expected_amount bigint not null check (expected_amount between -1000000000000 and 1000000000000),
  counted_amount bigint not null check (counted_amount between 0 and 1000000000000),
  difference bigint not null check (difference = counted_amount - expected_amount),
  note text not null default '' check (char_length(note) <= 500),
  client_operation_id uuid not null,
  closed_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  unique (organization_id, cash_account_id, day),
  foreign key (organization_id, cash_account_id)
    references app.cash_accounts (organization_id, id) on delete restrict
);

create index cash_closings_closed_by_idx on app.cash_closings (closed_by);

create trigger cash_transfers_no_update_delete
  before update or delete on app.cash_transfers
  for each row execute function app.reject_append_only_mutation();
create trigger cash_closings_no_update_delete
  before update or delete on app.cash_closings
  for each row execute function app.reject_append_only_mutation();
create trigger expenses_no_truncate
  before truncate on app.expenses
  for each statement execute function app.reject_append_only_mutation();
create trigger cash_transfers_no_truncate
  before truncate on app.cash_transfers
  for each statement execute function app.reject_append_only_mutation();
create trigger cash_closings_no_truncate
  before truncate on app.cash_closings
  for each statement execute function app.reject_append_only_mutation();

-- ---------------------------------------------------------------------------
-- Default accounts and categories of every shop
-- ---------------------------------------------------------------------------

create or replace function app.seed_shop_treasury(shop_id uuid)
returns void
language sql
set search_path = ''
as $$
  insert into app.cash_accounts (organization_id, kind, provider, name)
  values
    (shop_id, 'cash', null, 'Caisse'),
    (shop_id, 'mobile_money', 'wave', 'Wave'),
    (shop_id, 'mobile_money', 'orange_money', 'Orange Money'),
    (shop_id, 'mobile_money', 'free_money', 'Free Money'),
    (shop_id, 'mobile_money', 'other', 'Autre Mobile Money'),
    (shop_id, 'bank', null, 'Banque')
  on conflict do nothing;
  -- Accounts of the revised SYSCOHADA chart, editable by the shop.
  insert into app.expense_categories (organization_id, name, account_code)
  values
    (shop_id, 'Achat de marchandises', '601'),
    (shop_id, 'Eau et électricité', '605'),
    (shop_id, 'Transport', '61'),
    (shop_id, 'Loyer', '622'),
    (shop_id, 'Entretien et réparations', '624'),
    (shop_id, 'Téléphone et internet', '628'),
    (shop_id, 'Impôts et taxes', '64'),
    (shop_id, 'Salaires', '66'),
    (shop_id, 'Autres dépenses', '658')
  on conflict do nothing;
$$;

create or replace function app.organizations_seed_treasury()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform app.seed_shop_treasury(new.id);
  return new;
end;
$$;

create trigger organizations_seed_treasury
  after insert on app.organizations
  for each row execute function app.organizations_seed_treasury();

select app.seed_shop_treasury(id) from app.organizations;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on app.cash_accounts, app.expense_categories, app.expenses, app.cash_transfers, app.cash_closings from public;
revoke all on function app.seed_shop_treasury(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.cash_accounts, app.expense_categories, app.expenses, app.cash_transfers, app.cash_closings from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.cash_accounts, app.expense_categories, app.expenses, app.cash_transfers, app.cash_closings from authenticated';
  end if;
end
$$;

grant select, insert, update on app.cash_accounts, app.expense_categories, app.expenses to nagaw_api;
grant select, insert on app.cash_transfers, app.cash_closings to nagaw_api;
grant execute on function app.seed_shop_treasury(uuid) to nagaw_api;

alter table app.cash_accounts enable row level security;
alter table app.expense_categories enable row level security;
alter table app.expenses enable row level security;
alter table app.cash_transfers enable row level security;
alter table app.cash_closings enable row level security;

create policy api_access on app.cash_accounts
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.expense_categories
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.expenses
  for all to nagaw_api using (true) with check (true);
create policy api_read on app.cash_transfers for select to nagaw_api using (true);
create policy api_append on app.cash_transfers for insert to nagaw_api with check (true);
create policy api_read on app.cash_closings for select to nagaw_api using (true);
create policy api_append on app.cash_closings for insert to nagaw_api with check (true);
