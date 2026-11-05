-- Payment of an order by Wave (ADR-065, Phase 21).
--
-- Each shop connects its own Wave Business account: the money goes to the
-- shop, never to Nagaw. Its API key, and the optional signing and webhook
-- secrets, are sealed by the API with a master key outside the database
-- (ADR-009): this table only ever holds ciphertext.

create table app.organization_wave_accounts (
  organization_id uuid primary key
    references app.organizations (id) on delete restrict,
  api_key_sealed text not null check (api_key_sealed ~ '^v1\.'),
  -- Request signing, when the key was created with it (Wave docs).
  signing_secret_sealed text check (signing_secret_sealed ~ '^v1\.'),
  -- Webhook secret, when the shop registered our address in its portal.
  webhook_secret_sealed text check (webhook_secret_sealed ~ '^v1\.'),
  -- The last characters of the key, to tell which one is connected.
  key_hint text not null check (key_hint ~ '^[A-Za-z0-9_-]{4}$'),
  connected_by uuid not null references app.user_profiles (id) on delete restrict,
  connected_at timestamptz not null default now(),
  -- Removing the account keeps the row, emptied: no delete in `app`.
  disconnected_at timestamptz
);

-- The checkout session of an order: reused while it is open, so that a
-- customer who taps twice does not open two payments.
alter table app.orders
  add column wave_session_id text check (wave_session_id ~ '^cos-[A-Za-z0-9]{1,40}$'),
  add column wave_session_expires_at timestamptz,
  add column wave_launch_url text check (wave_launch_url ~ '^https://'),
  add column wave_transaction_id text check (char_length(wave_transaction_id) <= 60);

create unique index orders_wave_session_idx
  on app.orders (organization_id, wave_session_id)
  where wave_session_id is not null;

revoke all on app.organization_wave_accounts from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.organization_wave_accounts from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.organization_wave_accounts from authenticated';
  end if;
end
$$;

grant select, insert, update on app.organization_wave_accounts to nagaw_api;

alter table app.organization_wave_accounts enable row level security;
create policy api_access on app.organization_wave_accounts
  for all to nagaw_api using (true) with check (true);
