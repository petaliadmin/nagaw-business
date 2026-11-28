-- Ma vitrine (ADR-075): the catalogue as a web link, orders sent by
-- customers without an account, confirmed by the shop, paid at pickup.
--
-- Off for every shop until the owner or a manager turns it on.

alter table app.organizations
  add column storefront_enabled boolean not null default false,
  add column storefront_tagline text not null default ''
    check (char_length(storefront_tagline) <= 160),
  add column storefront_landmark text not null default ''
    check (char_length(storefront_landmark) <= 120),
  add column storefront_hours text not null default ''
    check (char_length(storefront_hours) <= 120),
  -- Empty: the phone of the shop.
  add column storefront_whatsapp text not null default ''
    check (char_length(storefront_whatsapp) <= 30),
  add column storefront_indexable boolean not null default false;

-- The address of a storefront, `/b/{slug}`. The old ones stay and lead to
-- the current one, so that a status already posted never ends nowhere.
create table app.storefront_slugs (
  slug text primary key
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' and slug !~ '--'),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index storefront_slugs_current_key
  on app.storefront_slugs (organization_id) where is_current;
create index storefront_slugs_org_idx on app.storefront_slugs (organization_id);

alter table app.products
  add column storefront_visible boolean not null default false,
  -- `/b/{slug}/a/{handle}`: from the name, unique in the shop.
  add column storefront_handle text
    check (storefront_handle ~ '^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$'),
  add column storefront_description text not null default ''
    check (char_length(storefront_description) <= 300),
  add column storefront_price_mode text not null default 'shown'
    check (storefront_price_mode in ('shown', 'on_request'));
create unique index products_storefront_handle_key
  on app.products (organization_id, storefront_handle)
  where storefront_handle is not null;

-- An order sent from the storefront: nobody of the shop took it, and the
-- person becomes a customer only when the shop accepts it.
alter table app.orders
  add column source text not null default 'counter'
    check (source in ('counter', 'storefront')),
  add column requester_name text not null default ''
    check (char_length(requester_name) <= 80),
  add column requester_phone text not null default ''
    check (char_length(requester_phone) <= 30),
  -- sha256 of the tracking token, in hex; the token itself is never kept.
  add column tracking_token_hash text
    check (tracking_token_hash ~ '^[0-9a-f]{64}$'),
  alter column created_by drop not null,
  alter column customer_id drop not null;

alter table app.orders drop constraint orders_status_check;
alter table app.orders add constraint orders_status_check
  check (status in ('to_confirm', 'received', 'in_preparation', 'ready',
                    'out_for_delivery', 'delivered', 'cancelled'));

alter table app.orders
  add constraint orders_storefront_check check (
    case source
      when 'counter' then created_by is not null and customer_id is not null
                          and status <> 'to_confirm'
      else fulfilment = 'pickup' and delivery_fee = 0
           and tracking_token_hash is not null
           and created_by is null
           -- A refused order has no customer; its name and number are
           -- erased after the shop's retention days (ADR-075).
           and (customer_id is not null or status in ('to_confirm', 'cancelled'))
    end
  );
create unique index orders_tracking_token_key
  on app.orders (tracking_token_hash) where tracking_token_hash is not null;
create index orders_to_confirm_idx
  on app.orders (organization_id, created_at) where status = 'to_confirm';
create index orders_requester_phone_idx
  on app.orders (organization_id, requester_phone) where status = 'to_confirm';

-- Nothing is paid before the shop confirms: payment at pickup (ADR-075).
create function app.reject_payment_to_confirm()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from app.orders o
              where o.organization_id = new.organization_id
                and o.id = new.order_id and o.status = 'to_confirm') then
    raise exception 'An order to confirm takes no payment'
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;
create trigger order_payments_not_to_confirm
  before insert on app.order_payments
  for each row execute function app.reject_payment_to_confirm();

-- Visits and orders of a storefront, by day: no cookie, no address kept.
create table app.storefront_daily_stats (
  organization_id uuid not null references app.organizations (id) on delete restrict,
  day date not null,
  visits integer not null default 0 check (visits >= 0),
  orders_sent integer not null default 0 check (orders_sent >= 0),
  orders_accepted integer not null default 0 check (orders_accepted >= 0),
  primary key (organization_id, day)
);

-- Orders sent from the storefront, counted against the limits: one row per
-- key, its count starting again when its window is over (like
-- phone_sign_in_failures). An address is kept as a sha256 only.
create table app.storefront_order_limits (
  key text primary key check (char_length(key) <= 120),
  count integer not null check (count >= 0),
  window_started_at timestamptz not null default now()
);

-- The limits, in base, never in the code.
alter table app.platform_settings
  add column storefront_max_orders_per_ip_hour integer not null default 10
    check (storefront_max_orders_per_ip_hour between 1 and 1000),
  add column storefront_max_orders_per_phone_day integer not null default 5
    check (storefront_max_orders_per_phone_day between 1 and 100),
  add column storefront_max_pending_per_phone integer not null default 3
    check (storefront_max_pending_per_phone between 1 and 50),
  add column storefront_declined_retention_days integer not null default 90
    check (storefront_declined_retention_days between 1 and 3650);

revoke all on app.storefront_slugs, app.storefront_daily_stats,
  app.storefront_order_limits from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.storefront_slugs, app.storefront_daily_stats, app.storefront_order_limits from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.storefront_slugs, app.storefront_daily_stats, app.storefront_order_limits from authenticated';
  end if;
end
$$;

grant select, insert, update on app.storefront_slugs to nagaw_api;
grant select, insert, update on app.storefront_daily_stats to nagaw_api;
grant select, insert, update on app.storefront_order_limits to nagaw_api;

alter table app.storefront_slugs enable row level security;
alter table app.storefront_daily_stats enable row level security;
alter table app.storefront_order_limits enable row level security;

create policy api_access on app.storefront_slugs
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.storefront_daily_stats
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.storefront_order_limits
  for all to nagaw_api using (true) with check (true);

-- « Commandes » in the notifications: an order sent from the storefront.
alter table app.notifications drop constraint notifications_category_check;
alter table app.notifications add constraint notifications_category_check
  check (category in ('stock', 'controls', 'credit', 'activity', 'summary', 'orders'));
alter table app.notification_preferences drop constraint notification_preferences_category_check;
alter table app.notification_preferences add constraint notification_preferences_category_check
  check (category in ('stock', 'controls', 'credit', 'activity', 'summary', 'orders'));
