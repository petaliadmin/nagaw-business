-- Owner decision (ADR-017): the application is fully manual and has no
-- agents. A responsibility is now entrusted to a member of the organization.
--
-- Non-destructive: the agents tables and `responsibilities.agent_id` are
-- kept (no data is deleted) but no longer used by the application.

alter table app.responsibilities add column assignee_user_id uuid;

-- Existing responsibilities go to their author, a member of the organization.
update app.responsibilities
set assignee_user_id = created_by
where assignee_user_id is null;

alter table app.responsibilities
  alter column assignee_user_id set not null,
  alter column agent_id drop not null,
  -- The assignee is always a member of the same organization.
  add constraint responsibilities_assignee_member_fk
    foreign key (organization_id, assignee_user_id)
    references app.organization_memberships (organization_id, user_id)
    on delete restrict;

create index responsibilities_assignee_idx
  on app.responsibilities (assignee_user_id);

comment on column app.responsibilities.agent_id is
  'Obsolète (ADR-017) : les responsabilités sont confiées à un membre.';
