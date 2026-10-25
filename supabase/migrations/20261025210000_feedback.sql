-- Phase 18 — feedback of the pilot shops (ADR-032).
--
-- Anyone of a shop tells the platform about a problem, an idea or a
-- question, from the page they are on. The platform reads and answers in
-- its administration. A message is never deleted.

create table app.feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  author_id uuid not null references app.user_profiles (id) on delete restrict,
  kind text not null check (kind in ('problem', 'idea', 'question')),
  message text not null check (char_length(message) between 1 and 2000),
  -- The page it was sent from, without its query string.
  page text not null default '' check (char_length(page) <= 200),
  status text not null default 'new' check (status in ('new', 'read', 'done')),
  answer text not null default '' check (char_length(answer) <= 2000),
  answered_at timestamptz,
  answered_by uuid references app.user_profiles (id) on delete restrict,
  client_operation_id uuid not null,
  created_at timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  check ((answer = '') = (answered_at is null))
);

create index feedback_status_idx on app.feedback (status, created_at desc);
create index feedback_org_idx on app.feedback (organization_id, created_at desc);
create index feedback_author_idx on app.feedback (author_id);
create index feedback_answered_by_idx on app.feedback (answered_by) where answered_by is not null;

-- Only the status and the answer change; the message stays as sent.
create or replace function app.feedback_only_answer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'feedback is never deleted' using errcode = 'insufficient_privilege';
  end if;
  if (to_jsonb(new) - array['status', 'answer', 'answered_at', 'answered_by'])
     is distinct from
     (to_jsonb(old) - array['status', 'answer', 'answered_at', 'answered_by'])
  then
    raise exception 'a feedback message is kept as sent' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger feedback_only_answer
  before update or delete on app.feedback
  for each row execute function app.feedback_only_answer();
create trigger feedback_no_truncate
  before truncate on app.feedback
  for each statement execute function app.reject_append_only_mutation();

revoke all on app.feedback from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.feedback from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.feedback from authenticated';
  end if;
end
$$;

grant select, insert, update on app.feedback to nagaw_api;
alter table app.feedback enable row level security;
create policy api_access on app.feedback for all to nagaw_api using (true) with check (true);
