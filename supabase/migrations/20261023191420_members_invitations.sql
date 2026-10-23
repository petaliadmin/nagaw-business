-- Phase 4 — invitations, member management and their thresholds.
--
-- Invitation tokens are 256-bit random values given once to the inviter;
-- only their SHA-256 hash is stored. An invitation grants admin, member or
-- viewer (ownership is only given by promotion) and is bound to the invited
-- e-mail address, which the API checks on acceptance.

-- ---------------------------------------------------------------------------
-- Thresholds, configurable per organization (never hard-coded)
-- ---------------------------------------------------------------------------

alter table app.organizations
  add column invitation_ttl_hours integer not null default 168
    check (invitation_ttl_hours between 1 and 720),
  add column max_pending_invitations integer not null default 50
    check (max_pending_invitations between 1 and 1000);

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------

create table app.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  email text not null
    check (email = lower(btrim(email)) and char_length(email) between 3 and 320
           and position('@' in email) > 1),
  role text not null check (role in ('admin', 'member', 'viewer')),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references app.user_profiles (id) on delete restrict,
  expires_at timestamptz not null,
  accepted_by uuid references app.user_profiles (id) on delete restrict,
  accepted_at timestamptz,
  revoked_by uuid references app.user_profiles (id) on delete restrict,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((status = 'accepted') = (accepted_by is not null and accepted_at is not null)),
  check ((status = 'revoked') = (revoked_by is not null and revoked_at is not null))
);

-- At most one live invitation per address and organization.
create unique index organization_invitations_one_pending_idx
  on app.organization_invitations (organization_id, email)
  where status = 'pending';
create index organization_invitations_org_idx
  on app.organization_invitations (organization_id, created_at desc);
create index organization_invitations_invited_by_idx
  on app.organization_invitations (invited_by);
create index organization_invitations_accepted_by_idx
  on app.organization_invitations (accepted_by) where accepted_by is not null;
create index organization_invitations_revoked_by_idx
  on app.organization_invitations (revoked_by) where revoked_by is not null;

create trigger organization_invitations_set_updated_at
  before update on app.organization_invitations
  for each row execute function app.set_updated_at();

-- Members are matched to invitations by address.
create index user_profiles_email_idx on app.user_profiles (lower(email));

-- ---------------------------------------------------------------------------
-- Every organization keeps at least one active owner
-- ---------------------------------------------------------------------------

-- Backstop for the API rules. Locks the organization row so that two
-- concurrent demotions cannot both see "another owner remains".
create or replace function app.ensure_active_owner_remains()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'owner' and old.status = 'active'
     and (new.role <> 'owner' or new.status <> 'active') then
    perform 1 from app.organizations where id = old.organization_id for update;
    if not exists (
      select 1 from app.organization_memberships
      where organization_id = old.organization_id
        and id <> old.id
        and role = 'owner'
        and status = 'active'
    ) then
      raise exception 'organization % would have no active owner', old.organization_id
        using errcode = 'check_violation', constraint = 'organization_has_active_owner';
    end if;
  end if;
  return new;
end;
$$;

create trigger organization_memberships_keep_owner
  before update of role, status on app.organization_memberships
  for each row execute function app.ensure_active_owner_remains();

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on app.organization_invitations from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.organization_invitations from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.organization_invitations from authenticated';
  end if;
end
$$;

grant select, insert, update on app.organization_invitations to nagaw_api;

alter table app.organization_invitations enable row level security;

create policy api_access on app.organization_invitations
  for all to nagaw_api using (true) with check (true);
