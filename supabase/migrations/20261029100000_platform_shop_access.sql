-- The platform administrator enters a shop (ADR-040, amends ADR-030).
--
-- An access is opened with a reason and stays open until closed. While it
-- is open, the administrator acts in the shop with the rights of an owner,
-- under their own identity; every action lands in the shop's history as
-- done by the platform.

create table app.platform_shop_accesses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app.organizations (id) on delete restrict,
  admin_id uuid not null references app.user_profiles (id) on delete restrict,
  reason text not null check (char_length(reason) between 1 and 500),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  check (closed_at is null or closed_at >= opened_at)
);

-- One open access per shop and administrator.
create unique index platform_shop_accesses_open_idx
  on app.platform_shop_accesses (organization_id, admin_id) where closed_at is null;
create index platform_shop_accesses_admin_idx
  on app.platform_shop_accesses (admin_id) where closed_at is null;

revoke all on app.platform_shop_accesses from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.platform_shop_accesses from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.platform_shop_accesses from authenticated';
  end if;
end
$$;

-- Opened and closed, never rewritten: the API may only set `closed_at`.
grant select, insert on app.platform_shop_accesses to nagaw_api;
grant update (closed_at) on app.platform_shop_accesses to nagaw_api;

alter table app.platform_shop_accesses enable row level security;
create policy api_read on app.platform_shop_accesses for select to nagaw_api using (true);
create policy api_open on app.platform_shop_accesses for insert to nagaw_api with check (true);
create policy api_close on app.platform_shop_accesses for update to nagaw_api
  using (closed_at is null) with check (closed_at is not null);

-- ---------------------------------------------------------------------------
-- What the administrator does inside a shop is signed by the platform
-- ---------------------------------------------------------------------------

-- Every service records its actor as a 'user'; when that user is the
-- platform administrator and not a member of the shop, the entry is
-- rewritten as done by the platform, whatever the service.
create function app.audit_mark_platform_actor()
returns trigger
language plpgsql
as $$
begin
  if new.actor_type = 'user'
     and new.actor_id is not null
     and new.organization_id is not null
     and exists (select 1 from app.platform_admins a where a.user_id = new.actor_id)
     and not exists (
       select 1 from app.organization_memberships m
        where m.organization_id = new.organization_id
          and m.user_id = new.actor_id
          and m.status = 'active'
     )
  then
    new.actor_type := 'platform_admin';
  end if;
  return new;
end
$$;

create trigger audit_logs_mark_platform_actor
  before insert on app.audit_logs
  for each row execute function app.audit_mark_platform_actor();
