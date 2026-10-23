-- Phase 6 — responsibilities: durable delegations entrusted to an agent.
--
-- A responsibility belongs to one agent of the same organization (composite
-- foreign key). The application is fully manual (ADR-017): there is no
-- schedule or automatic trigger, a person always starts the work. The
-- change history is the audit log.

-- ---------------------------------------------------------------------------
-- Caps, configurable per organization (never hard-coded)
-- ---------------------------------------------------------------------------

alter table app.organizations
  add column max_responsibilities integer not null default 50
    check (max_responsibilities between 1 and 10000),
  add column responsibility_max_runs_per_day integer not null default 24
    check (responsibility_max_runs_per_day between 1 and 1000);

-- ---------------------------------------------------------------------------
-- Responsibilities
-- ---------------------------------------------------------------------------

create table app.responsibilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  agent_id uuid not null,
  title text not null check (title = btrim(title) and char_length(title) between 3 and 120),
  objective text not null default '' check (char_length(objective) <= 2000),
  scope text not null default '' check (char_length(scope) <= 2000),
  rules text not null default '' check (char_length(rules) <= 5000),
  success_criteria text not null default '' check (char_length(success_criteria) <= 2000),
  max_runs_per_day integer not null check (max_runs_per_day between 1 and 1000),
  escalation_user_id uuid references app.user_profiles (id) on delete restrict,
  starts_on date,
  ends_on date,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'suspended', 'archived')),
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  -- The agent is always one of the same organization's agents.
  foreign key (organization_id, agent_id)
    references app.agents (organization_id, id) on delete restrict
);

create index responsibilities_org_created_idx
  on app.responsibilities (organization_id, created_at desc);
create index responsibilities_agent_idx on app.responsibilities (agent_id);
create index responsibilities_escalation_idx
  on app.responsibilities (escalation_user_id) where escalation_user_id is not null;
create index responsibilities_created_by_idx on app.responsibilities (created_by);
-- Lets the history query filter the audit log by target.
create index audit_logs_target_idx
  on app.audit_logs (organization_id, target_type, target_id, id desc);

create trigger responsibilities_set_updated_at
  before update on app.responsibilities
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on app.responsibilities from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.responsibilities from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.responsibilities from authenticated';
  end if;
end
$$;

grant select, insert, update on app.responsibilities to nagaw_api;

alter table app.responsibilities enable row level security;

create policy api_access on app.responsibilities
  for all to nagaw_api using (true) with check (true);
