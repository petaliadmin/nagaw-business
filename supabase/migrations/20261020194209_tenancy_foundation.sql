-- Phase 2 — tenancy foundation: profiles, organizations, memberships, audit log.
--
-- Business tables live in the private `app` schema, which the Supabase Data
-- API does not expose. Only the dedicated `nagaw_api` role (used by the NestJS
-- API) may touch them; `anon` and `authenticated` get no privileges at all.
-- RLS is enabled everywhere as defense in depth. Tenant scoping itself is
-- enforced by the API (ADR-005).

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nagaw_api') then
    -- NOLOGIN on purpose: the owner enables login and sets the password
    -- outside of Git (see docs/DEPLOYMENT.md).
    create role nagaw_api nologin noinherit;
  end if;
end
$$;

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to nagaw_api;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- User profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table app.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text check (display_name is null or char_length(display_name) between 1 and 120),
  locale text not null default 'fr' check (locale = 'fr'),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_profiles_set_updated_at
  before update on app.user_profiles
  for each row execute function app.set_updated_at();

-- Keeps profiles in sync with Supabase Auth. SECURITY DEFINER because the
-- trigger fires as the auth service role, which has no rights on `app`.
create or replace function app.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into app.user_profiles (id, email)
    values (new.id, coalesce(new.email, ''));
  elsif new.email is distinct from old.email then
    update app.user_profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function app.handle_auth_user_change() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_auth_user_change();

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function app.handle_auth_user_change();

-- ---------------------------------------------------------------------------
-- Organizations (tenants)
-- ---------------------------------------------------------------------------

create table app.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique
    check (char_length(slug) between 3 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active', 'suspended')),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  default_currency char(3) not null default 'XOF' check (default_currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizations_created_by_idx on app.organizations (created_by);

create trigger organizations_set_updated_at
  before update on app.organizations
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Memberships
-- ---------------------------------------------------------------------------

create table app.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  user_id uuid not null references app.user_profiles (id) on delete restrict,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_memberships_user_idx
  on app.organization_memberships (user_id) where status = 'active';

create trigger organization_memberships_set_updated_at
  before update on app.organization_memberships
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------

create table app.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references app.organizations (id) on delete restrict,
  actor_type text not null check (actor_type in ('user', 'agent', 'system', 'platform_admin')),
  actor_id uuid,
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create index audit_logs_org_id_idx on app.audit_logs (organization_id, id desc);

create or replace function app.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only (% rejected)', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_logs_no_update_delete
  before update or delete on app.audit_logs
  for each row execute function app.reject_audit_mutation();

create trigger audit_logs_no_truncate
  before truncate on app.audit_logs
  for each statement execute function app.reject_audit_mutation();

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on all tables in schema app from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema app from anon';
    execute 'revoke all on all tables in schema app from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema app from authenticated';
    execute 'revoke all on all tables in schema app from authenticated';
  end if;
end
$$;

grant select, insert, update on app.user_profiles to nagaw_api;
grant select, insert, update on app.organizations to nagaw_api;
grant select, insert, update on app.organization_memberships to nagaw_api;
grant select, insert on app.audit_logs to nagaw_api;

alter table app.user_profiles enable row level security;
alter table app.organizations enable row level security;
alter table app.organization_memberships enable row level security;
alter table app.audit_logs enable row level security;

create policy api_access on app.user_profiles
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.organizations
  for all to nagaw_api using (true) with check (true);
create policy api_access on app.organization_memberships
  for all to nagaw_api using (true) with check (true);
create policy api_read on app.audit_logs
  for select to nagaw_api using (true);
create policy api_append on app.audit_logs
  for insert to nagaw_api with check (true);
