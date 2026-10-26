-- Notifications, seller access and stock checks at the counter (ADR-036).
--
-- Notifications are rows addressed to one member of a shop. A notification
-- of the same group (« Ventes du jour », « Riz bientôt épuisé ») is updated
-- while it is unread instead of piling up. Push messages are sent from the
-- same rows (`push_status`), to the browsers a person registered. Every
-- threshold lives here, per shop, never in the code.

-- ---------------------------------------------------------------------------
-- Settings per shop
-- ---------------------------------------------------------------------------

alter table app.organizations
  -- Largest stock correction a seller may make at the counter (in units of
  -- the product); 0: sellers cannot correct the stock.
  add column seller_stock_correction_max numeric(14, 3) not null default 20
    check (seller_stock_correction_max between 0 and 100000),
  -- « Bientôt épuisé » when the stock lasts fewer days than this…
  add column stock_forecast_days integer not null default 3
    check (stock_forecast_days between 1 and 60),
  -- …at the pace of the sales of the last N days.
  add column stock_forecast_window_days integer not null default 14
    check (stock_forecast_window_days between 3 and 90),
  -- A customer who owes money and has paid nothing back for N days.
  add column credit_overdue_days integer not null default 30
    check (credit_overdue_days between 1 and 365),
  -- A credit sale bringing the customer's debt to this share of its limit.
  add column credit_near_limit_percent integer not null default 80
    check (credit_near_limit_percent between 1 and 100),
  -- Local hour of the evening summary.
  add column daily_summary_hour integer not null default 20
    check (daily_summary_hour between 0 and 23),
  -- Last local day whose daily notifications were prepared (taken atomically).
  add column daily_run_on date;

-- A sale that took more goods than the stock the server knew.
alter table app.sales
  add column stock_review boolean not null default false;
create index sales_stock_review_idx on app.sales (organization_id) where stock_review;
-- The cancellation trigger compares every other column: the new one is
-- covered as part of the row.

-- Stock corrections travel with the sales of a phone (ADR-036): their
-- refusals are counted like the others.
alter table app.sync_rejections
  drop constraint sync_rejections_operation_type_check,
  add constraint sync_rejections_operation_type_check
    check (operation_type in ('sale', 'customer', 'stock_correction'));

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table app.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  recipient_id uuid not null,
  category text not null
    check (category in ('stock', 'controls', 'credit', 'activity', 'summary')),
  kind text not null check (char_length(kind) between 1 and 60),
  severity text not null default 'info' check (severity in ('info', 'warning', 'danger')),
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body) <= 1000),
  -- A page of the application, never an outside address.
  link text check (link ~ '^/(espace|caisse)(/|\?|$)' and char_length(link) <= 300),
  -- One unread notification per group and recipient (see the index below).
  group_key text not null check (char_length(group_key) between 1 and 200),
  occurrences integer not null default 1 check (occurrences >= 1),
  data jsonb not null default '{}'::jsonb,
  push_status text not null default 'none'
    check (push_status in ('none', 'pending', 'sent', 'failed')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, recipient_id)
    references app.organization_memberships (organization_id, user_id) on delete restrict
);

create unique index notifications_open_group_idx
  on app.notifications (organization_id, recipient_id, group_key) where read_at is null;
create index notifications_recipient_idx
  on app.notifications (organization_id, recipient_id, updated_at desc, id desc);
create index notifications_group_idx
  on app.notifications (organization_id, group_key, created_at desc);
create index notifications_push_pending_idx
  on app.notifications (created_at) where push_status = 'pending';
create index notifications_recipient_fk_idx on app.notifications (recipient_id);

create trigger notifications_set_updated_at
  before update on app.notifications
  for each row execute function app.set_updated_at();

-- What a notification is about never changes: only its text (grouping),
-- its counter, its push state and its reading.
create or replace function app.notifications_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'notifications are never deleted' using errcode = 'insufficient_privilege';
  end if;
  if (to_jsonb(new) - array['title', 'body', 'severity', 'occurrences', 'data',
        'push_status', 'read_at', 'updated_at'])
     is distinct from (to_jsonb(old) - array['title', 'body', 'severity', 'occurrences',
        'data', 'push_status', 'read_at', 'updated_at'])
  then
    raise exception 'only the text and the state of a notification change'
      using errcode = 'insufficient_privilege';
  end if;
  if old.read_at is not null and new.read_at is null then
    raise exception 'a read notification stays read' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger notifications_guard
  before update or delete on app.notifications
  for each row execute function app.notifications_guard();
create trigger notifications_no_truncate
  before truncate on app.notifications
  for each statement execute function app.reject_append_only_mutation();

-- What a person wants to receive, per shop and category. No row: the
-- default of the role (packages/shared/src/notifications.ts).
create table app.notification_preferences (
  organization_id uuid not null,
  user_id uuid not null,
  category text not null
    check (category in ('stock', 'controls', 'credit', 'activity', 'summary')),
  enabled boolean not null,
  push boolean not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id, category),
  foreign key (organization_id, user_id)
    references app.organization_memberships (organization_id, user_id) on delete restrict
);

create index notification_preferences_user_idx on app.notification_preferences (user_id);

create trigger notification_preferences_set_updated_at
  before update on app.notification_preferences
  for each row execute function app.set_updated_at();

-- Browsers that receive push messages (Web Push). A browser belongs to the
-- last person who registered it; it is switched off, never deleted.
create table app.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.user_profiles (id) on delete restrict,
  endpoint text not null unique
    check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  label text not null default '' check (char_length(label) <= 120),
  failure_count integer not null default 0 check (failure_count >= 0),
  last_success_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_idx
  on app.push_subscriptions (user_id) where disabled_at is null;

create trigger push_subscriptions_set_updated_at
  before update on app.push_subscriptions
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on app.notifications, app.notification_preferences, app.push_subscriptions
  from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.notifications, app.notification_preferences,
      app.push_subscriptions from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.notifications, app.notification_preferences,
      app.push_subscriptions from authenticated';
  end if;
end
$$;

-- No DELETE anywhere (ADR-013): notifications are read, browsers switched off.
grant select, insert, update on app.notifications, app.notification_preferences,
  app.push_subscriptions to nagaw_api;

alter table app.notifications enable row level security;
alter table app.notification_preferences enable row level security;
alter table app.push_subscriptions enable row level security;

create policy api_access on app.notifications
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.notification_preferences
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.push_subscriptions
  for all to nagaw_api using (true) with check (true);
