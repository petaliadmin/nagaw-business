-- Phase 12 — quotes, invoices and credit notes (ADR-026).
--
-- Legal numbers (F-2026-0001) are given by the server when a document is
-- issued, from a sequence per shop, kind and year, under a row lock: no gap,
-- no duplicate. An issued invoice never changes; it is cancelled by a credit
-- note. Lines are kept as validated JSON on the document (editable only
-- while it is a draft), so drafts need no DELETE privilege (ADR-013).

-- ---------------------------------------------------------------------------
-- Shop identity on documents, and document settings (never hard-coded)
-- ---------------------------------------------------------------------------

alter table app.organizations
  add column legal_name text not null default '' check (char_length(legal_name) <= 160),
  add column address text not null default '' check (char_length(address) <= 300),
  add column phone text not null default '' check (char_length(phone) <= 30),
  add column email text not null default '' check (char_length(email) <= 320),
  -- NINEA (Sénégal) or other tax identification number.
  add column tax_id text not null default '' check (char_length(tax_id) <= 40),
  -- RCCM or other trade register number.
  add column trade_register text not null default '' check (char_length(trade_register) <= 60),
  add column invoice_footer text not null default '' check (char_length(invoice_footer) <= 500),
  add column invoice_due_days integer not null default 30
    check (invoice_due_days between 0 and 365),
  add column quote_validity_days integer not null default 30
    check (quote_validity_days between 1 and 365);

alter table app.customers
  add column email text not null default '' check (char_length(email) <= 320),
  add column address text not null default '' check (char_length(address) <= 300),
  add column tax_id text not null default '' check (char_length(tax_id) <= 40);

-- ---------------------------------------------------------------------------
-- Numbering
-- ---------------------------------------------------------------------------

create table app.document_sequences (
  organization_id uuid not null references app.organizations (id) on delete restrict,
  kind text not null check (kind in ('quote', 'invoice', 'credit_note')),
  year integer not null check (year between 2000 and 2999),
  next_number integer not null default 1 check (next_number >= 1),
  primary key (organization_id, kind, year)
);

-- ---------------------------------------------------------------------------
-- Quotes
-- ---------------------------------------------------------------------------

create table app.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  number text not null check (number ~ '^D-[0-9]{4}-[0-9]{4,}$'),
  customer_id uuid not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'refused')),
  issue_date date not null,
  valid_until date not null check (valid_until >= issue_date),
  -- Lines as validated by @nagaw/shared (documentLineSchema).
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  subtotal bigint not null check (subtotal between 0 and 1000000000000),
  discount bigint not null default 0 check (discount between 0 and subtotal),
  total bigint not null check (total = subtotal - discount),
  tax_total bigint not null check (tax_total between 0 and total),
  client_operation_id uuid not null,
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, number),
  unique (organization_id, client_operation_id),
  foreign key (organization_id, customer_id)
    references app.customers (organization_id, id) on delete restrict
);

create index quotes_org_created_idx on app.quotes (organization_id, created_at desc);
create index quotes_customer_idx on app.quotes (organization_id, customer_id);
create index quotes_created_by_idx on app.quotes (created_by);

create trigger quotes_set_updated_at
  before update on app.quotes
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Invoices and credit notes
-- ---------------------------------------------------------------------------

create table app.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  kind text not null default 'invoice' check (kind in ('invoice', 'credit_note')),
  -- Given at issue; a draft has none.
  number text check (number ~ '^[FA]-[0-9]{4}-[0-9]{4,}$'),
  status text not null default 'draft' check (status in ('draft', 'issued', 'cancelled')),
  customer_id uuid not null,
  quote_id uuid,
  sale_id uuid,
  -- For a credit note: the invoice it cancels.
  credit_for_id uuid,
  issue_date date,
  due_date date,
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  subtotal bigint not null check (subtotal between 0 and 1000000000000),
  discount bigint not null default 0 check (discount between 0 and subtotal),
  total bigint not null check (total = subtotal - discount),
  tax_total bigint not null check (tax_total between 0 and total),
  issued_at timestamptz,
  issued_by uuid references app.user_profiles (id) on delete restrict,
  cancelled_at timestamptz,
  cancelled_by uuid references app.user_profiles (id) on delete restrict,
  cancel_reason text check (char_length(cancel_reason) between 1 and 500),
  client_operation_id uuid not null,
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, number),
  unique (organization_id, client_operation_id),
  -- Issued documents carry their number, date and author.
  check ((status = 'draft') = (number is null)),
  check ((status = 'draft') = (issued_at is null and issued_by is null and issue_date is null)),
  check ((status = 'cancelled') = (cancelled_at is not null and cancelled_by is not null and cancel_reason is not null)),
  check (kind = 'invoice' or (credit_for_id is not null and status <> 'cancelled')),
  check (kind = 'credit_note' or credit_for_id is null),
  check (number is null or (kind = 'invoice') = (number like 'F-%')),
  check (due_date is null or issue_date is null or due_date >= issue_date),
  foreign key (organization_id, customer_id)
    references app.customers (organization_id, id) on delete restrict,
  foreign key (organization_id, quote_id)
    references app.quotes (organization_id, id) on delete restrict,
  foreign key (organization_id, sale_id)
    references app.sales (organization_id, id) on delete restrict,
  foreign key (organization_id, credit_for_id)
    references app.invoices (organization_id, id) on delete restrict
);

create index invoices_org_created_idx on app.invoices (organization_id, created_at desc);
create index invoices_customer_idx on app.invoices (organization_id, customer_id);
create index invoices_quote_idx on app.invoices (organization_id, quote_id) where quote_id is not null;
create index invoices_sale_idx on app.invoices (organization_id, sale_id) where sale_id is not null;
create unique index invoices_one_credit_note_key
  on app.invoices (organization_id, credit_for_id) where credit_for_id is not null;
create index invoices_created_by_idx on app.invoices (created_by);
create index invoices_issued_by_idx on app.invoices (issued_by) where issued_by is not null;
create index invoices_cancelled_by_idx on app.invoices (cancelled_by) where cancelled_by is not null;

create trigger invoices_set_updated_at
  before update on app.invoices
  for each row execute function app.set_updated_at();

-- A draft may change freely; an issued document only gets cancelled, with
-- its three fields; nothing else ever changes, and nothing is deleted.
create or replace function app.invoices_issued_are_final()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'invoices are never deleted' using errcode = 'insufficient_privilege';
  end if;
  if old.status = 'draft' then
    return new;
  end if;
  if old.status = 'issued' and new.status = 'cancelled'
     and (to_jsonb(new) - array['status', 'cancelled_at', 'cancelled_by', 'cancel_reason', 'updated_at'])
         is not distinct from
         (to_jsonb(old) - array['status', 'cancelled_at', 'cancelled_by', 'cancel_reason', 'updated_at'])
  then
    return new;
  end if;
  raise exception 'an issued invoice can only be cancelled by a credit note'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger invoices_issued_are_final
  before update or delete on app.invoices
  for each row execute function app.invoices_issued_are_final();

create trigger invoices_no_truncate
  before truncate on app.invoices
  for each statement execute function app.reject_append_only_mutation();

-- ---------------------------------------------------------------------------
-- Payments of invoices
-- ---------------------------------------------------------------------------

create table app.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invoice_id uuid not null,
  method text not null
    check (method in ('cash', 'mobile_money', 'card', 'bank_transfer', 'cheque')),
  provider text check (provider in ('wave', 'orange_money', 'free_money', 'other')),
  reference text check (char_length(reference) between 1 and 60),
  amount bigint not null check (amount > 0),
  paid_on date not null,
  -- Settled at the counter by the sale the invoice was made from: already
  -- in the sale's payments, never counted twice (Phase 13).
  from_sale boolean not null default false,
  client_operation_id uuid not null,
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  check ((method = 'mobile_money') = (provider is not null)),
  foreign key (organization_id, invoice_id)
    references app.invoices (organization_id, id) on delete restrict
);

create index invoice_payments_invoice_idx on app.invoice_payments (organization_id, invoice_id);
create index invoice_payments_created_by_idx on app.invoice_payments (created_by);

create trigger invoice_payments_no_update_delete
  before update or delete on app.invoice_payments
  for each row execute function app.reject_append_only_mutation();
create trigger invoice_payments_no_truncate
  before truncate on app.invoice_payments
  for each statement execute function app.reject_append_only_mutation();

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on app.document_sequences, app.quotes, app.invoices, app.invoice_payments from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.document_sequences, app.quotes, app.invoices, app.invoice_payments from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.document_sequences, app.quotes, app.invoices, app.invoice_payments from authenticated';
  end if;
end
$$;

grant select, insert, update on app.document_sequences, app.quotes, app.invoices to nagaw_api;
grant select, insert on app.invoice_payments to nagaw_api;

alter table app.document_sequences enable row level security;
alter table app.quotes enable row level security;
alter table app.invoices enable row level security;
alter table app.invoice_payments enable row level security;

create policy api_access on app.document_sequences
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.quotes
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.invoices
  for all to nagaw_api using (true) with check (true);
create policy api_read on app.invoice_payments for select to nagaw_api using (true);
create policy api_append on app.invoice_payments for insert to nagaw_api with check (true);
