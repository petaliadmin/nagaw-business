-- Phase 14 — minimal cash accounting of the revised SYSCOHADA (ADR-028).
--
-- The journal of receipts and expenses is computed from the money movements
-- (ADR-027); this migration only gives expenses what an accountant needs:
-- a voucher number given by the server, without gap, and a receipt photo.

-- ---------------------------------------------------------------------------
-- Voucher numbers of expenses (DEP-2026-0001)
-- ---------------------------------------------------------------------------

alter table app.document_sequences drop constraint document_sequences_kind_check;
alter table app.document_sequences
  add constraint document_sequences_kind_check
  check (kind in ('quote', 'invoice', 'credit_note', 'expense'));

alter table app.expenses
  add column number text check (number ~ '^DEP-[0-9]{4}-[0-9]{4,}$'),
  add constraint expenses_org_id_key unique (organization_id, id),
  add constraint expenses_number_key unique (organization_id, number);

-- Expenses recorded before this migration get their number in the order
-- they were recorded, per shop and year of the expense. The cancellation
-- trigger is set aside for this one update only.
alter table app.expenses disable trigger expenses_only_cancellation;

with numbered as (
  select id,
         extract(year from occurred_on)::int as year,
         row_number() over (
           partition by organization_id, extract(year from occurred_on)
           order by created_at, id
         ) as n
    from app.expenses
)
update app.expenses e
   set number = 'DEP-' || numbered.year || '-' || lpad(numbered.n::text, 4, '0')
  from numbered
 where numbered.id = e.id;

alter table app.expenses enable trigger expenses_only_cancellation;

insert into app.document_sequences (organization_id, kind, year, next_number)
select organization_id, 'expense', extract(year from occurred_on)::int, count(*) + 1
  from app.expenses
 group by organization_id, extract(year from occurred_on);

alter table app.expenses alter column number set not null;

-- ---------------------------------------------------------------------------
-- Receipt photos (one per expense, replaceable, never deleted)
-- ---------------------------------------------------------------------------

create table app.expense_receipts (
  organization_id uuid not null,
  expense_id uuid not null,
  content_type text not null check (content_type in ('image/webp', 'image/jpeg', 'image/png')),
  data bytea not null check (octet_length(data) between 1 and 524288),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  updated_by uuid not null references app.user_profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (organization_id, expense_id),
  foreign key (organization_id, expense_id)
    references app.expenses (organization_id, id) on delete restrict
);

create index expense_receipts_updated_by_idx on app.expense_receipts (updated_by);

create trigger expense_receipts_no_delete
  before delete on app.expense_receipts
  for each row execute function app.reject_append_only_mutation();
create trigger expense_receipts_no_truncate
  before truncate on app.expense_receipts
  for each statement execute function app.reject_append_only_mutation();

revoke all on app.expense_receipts from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.expense_receipts from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.expense_receipts from authenticated';
  end if;
end
$$;

grant select, insert, update on app.expense_receipts to nagaw_api;
alter table app.expense_receipts enable row level security;
create policy api_access on app.expense_receipts
  for all to nagaw_api using (true) with check (true);
