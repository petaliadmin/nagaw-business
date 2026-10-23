-- Phase 5 — digital agents and their versioned configuration.
--
-- An agent's identity (name, role, status) lives in `agents`; everything that
-- drives its behavior lives in immutable `agent_versions`. Each configuration
-- change appends a version and moves `current_version_id`, so the history of
-- what an agent was told to do is never rewritten. No AI model is configured
-- (ADR-007): there is deliberately no provider/model column yet.

-- ---------------------------------------------------------------------------
-- Caps, configurable per organization (never hard-coded)
-- ---------------------------------------------------------------------------

alter table app.organizations
  add column max_agents integer not null default 10
    check (max_agents between 1 and 1000),
  add column agent_max_steps integer not null default 20
    check (agent_max_steps between 1 and 100),
  add column agent_max_duration_seconds integer not null default 300
    check (agent_max_duration_seconds between 10 and 3600);

-- ---------------------------------------------------------------------------
-- Agents
-- ---------------------------------------------------------------------------

create table app.agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  name text not null check (name = btrim(name) and char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 500),
  role_key text not null check (role_key in (
    'sales', 'finance', 'marketing', 'hr', 'management',
    'customer_service', 'operations', 'other'
  )),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'suspended', 'archived')),
  current_version_id uuid not null,
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

-- Names are unique among an organization's non-archived agents.
create unique index agents_org_name_idx
  on app.agents (organization_id, lower(name)) where status <> 'archived';
create index agents_org_created_idx on app.agents (organization_id, created_at desc);
create index agents_created_by_idx on app.agents (created_by);

create trigger agents_set_updated_at
  before update on app.agents
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Versions (append-only)
-- ---------------------------------------------------------------------------

create table app.agent_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  agent_id uuid not null,
  version integer not null check (version >= 1),
  instructions text not null check (char_length(instructions) <= 20000),
  objectives text not null check (char_length(objectives) <= 2000),
  max_steps integer not null check (max_steps between 1 and 100),
  max_duration_seconds integer not null check (max_duration_seconds between 10 and 3600),
  error_policy text not null check (error_policy in ('stop', 'retry_once', 'escalate')),
  -- Tool keys are validated against the code registry by the API.
  tools text[] not null default '{}' check (cardinality(tools) <= 50),
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (agent_id, version),
  unique (agent_id, id),
  -- A version always belongs to an agent of the same organization.
  foreign key (organization_id, agent_id)
    references app.agents (organization_id, id) on delete restrict
);

create index agent_versions_created_by_idx on app.agent_versions (created_by);

-- The current version is one of the agent's own versions. Deferred, so that
-- an agent and its first version can be inserted in one transaction.
alter table app.agents
  add constraint agents_current_version_fk
  foreign key (id, current_version_id)
  references app.agent_versions (agent_id, id)
  deferrable initially deferred;

create or replace function app.reject_append_only_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only (% rejected)', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger agent_versions_no_update_delete
  before update or delete on app.agent_versions
  for each row execute function app.reject_append_only_mutation();

create trigger agent_versions_no_truncate
  before truncate on app.agent_versions
  for each statement execute function app.reject_append_only_mutation();

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on app.agents, app.agent_versions from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.agents, app.agent_versions from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.agents, app.agent_versions from authenticated';
  end if;
end
$$;

grant select, insert, update on app.agents to nagaw_api;
grant select, insert on app.agent_versions to nagaw_api;

alter table app.agents enable row level security;
alter table app.agent_versions enable row level security;

create policy api_access on app.agents
  for all to nagaw_api using (true) with check (true);
create policy api_read on app.agent_versions
  for select to nagaw_api using (true);
create policy api_append on app.agent_versions
  for insert to nagaw_api with check (true);
