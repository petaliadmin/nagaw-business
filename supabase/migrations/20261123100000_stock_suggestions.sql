-- Suggest counting the stock of a product sold often (ADR-070).
--
-- A product whose stock is not counted, sold in at least
-- `stock_suggestion_min_sales` sales over the last
-- `stock_suggestion_window_days` days, is suggested on the home page of
-- the owner and the managers: « Compter son stock », « Plus tard » (for
-- `stock_suggestion_snooze_days` days) or « Ne plus proposer ».

alter table app.organizations
  add column stock_suggestion_min_sales integer not null default 5
    check (stock_suggestion_min_sales between 1 and 1000),
  add column stock_suggestion_window_days integer not null default 14
    check (stock_suggestion_window_days between 1 and 90),
  add column stock_suggestion_snooze_days integer not null default 7
    check (stock_suggestion_snooze_days between 1 and 90);

create table app.stock_suggestion_dismissals (
  organization_id uuid not null references app.organizations (id) on delete restrict,
  product_id uuid not null,
  -- Null: never again; otherwise suggested again from this moment.
  until timestamptz,
  dismissed_by uuid not null references app.user_profiles (id) on delete restrict,
  dismissed_at timestamptz not null default now(),
  primary key (organization_id, product_id),
  foreign key (organization_id, product_id)
    references app.products (organization_id, id) on delete restrict
);

create index stock_suggestion_dismissals_dismissed_by_idx
  on app.stock_suggestion_dismissals (dismissed_by);

revoke all on app.stock_suggestion_dismissals from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.stock_suggestion_dismissals from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.stock_suggestion_dismissals from authenticated';
  end if;
end
$$;

grant select, insert, update on app.stock_suggestion_dismissals to nagaw_api;

alter table app.stock_suggestion_dismissals enable row level security;

create policy api_access on app.stock_suggestion_dismissals
  for all to nagaw_api using (true) with check (true);
