-- Phase 7 — manual task tracking (ADR-017).
--
-- A task is concrete work done by a person: someone launches it, records
-- what was done, then closes it. Nothing runs automatically. A task belongs
-- to a responsibility of the same organization, or stands alone (one-off).
-- `task_notes` is the task's journal (append-only); status changes and
-- edits are in the audit log.

-- ---------------------------------------------------------------------------
-- Cap, configurable per organization (never hard-coded)
-- ---------------------------------------------------------------------------

alter table app.organizations
  add column max_open_tasks integer not null default 500
    check (max_open_tasks between 1 and 100000);

-- Target of the composite foreign key below (tenant integrity).
alter table app.responsibilities
  add constraint responsibilities_organization_id_id_key
    unique (organization_id, id);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

create table app.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  responsibility_id uuid,
  title text not null check (title = btrim(title) and char_length(title) between 3 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  assignee_user_id uuid not null,
  due_on date,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'blocked', 'done', 'cancelled')),
  outcome text check (outcome in ('achieved', 'partial', 'not_achieved')),
  report text not null default '' check (char_length(report) <= 5000),
  blocked_reason text check (char_length(blocked_reason) <= 1000),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references app.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  -- A finished task always says how it went and what was done.
  check ((status = 'done') = (outcome is not null)),
  check (status <> 'done' or char_length(btrim(report)) > 0),
  check (status <> 'blocked' or blocked_reason is not null),
  check ((status in ('done', 'cancelled')) = (completed_at is not null)),
  -- The responsibility and the assignee always belong to the same organization.
  foreign key (organization_id, responsibility_id)
    references app.responsibilities (organization_id, id) on delete restrict,
  foreign key (organization_id, assignee_user_id)
    references app.organization_memberships (organization_id, user_id) on delete restrict
);

create index tasks_org_created_idx on app.tasks (organization_id, created_at desc);
create index tasks_org_status_idx on app.tasks (organization_id, status);
create index tasks_assignee_idx on app.tasks (assignee_user_id);
-- Daily count per responsibility (cap) and the responsibility's task list.
create index tasks_responsibility_created_idx
  on app.tasks (responsibility_id, created_at desc) where responsibility_id is not null;
create index tasks_created_by_idx on app.tasks (created_by);

create trigger tasks_set_updated_at
  before update on app.tasks
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Task notes (append-only journal)
-- ---------------------------------------------------------------------------

create table app.task_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id uuid not null,
  author_id uuid not null references app.user_profiles (id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  foreign key (organization_id, task_id)
    references app.tasks (organization_id, id) on delete restrict
);

create index task_notes_task_idx on app.task_notes (task_id, created_at desc);
create index task_notes_author_idx on app.task_notes (author_id);

create trigger task_notes_no_update_delete
  before update or delete on app.task_notes
  for each row execute function app.reject_append_only_mutation();

create trigger task_notes_no_truncate
  before truncate on app.task_notes
  for each statement execute function app.reject_append_only_mutation();

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on app.tasks, app.task_notes from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.tasks, app.task_notes from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.tasks, app.task_notes from authenticated';
  end if;
end
$$;

grant select, insert, update on app.tasks to nagaw_api;
grant select, insert on app.task_notes to nagaw_api;

alter table app.tasks enable row level security;
alter table app.task_notes enable row level security;

create policy api_access on app.tasks
  for all to nagaw_api using (true) with check (true);
create policy api_read on app.task_notes
  for select to nagaw_api using (true);
create policy api_append on app.task_notes
  for insert to nagaw_api with check (true);
