-- A shop's signature and stamp, printed on its issued invoices (ADR-052). Like
-- the logo: small, PNG or JPEG, and removing one only clears the pointer.

alter table app.organizations
  add column signature_sha256 text check (signature_sha256 ~ '^[0-9a-f]{64}$'),
  add column stamp_sha256 text check (stamp_sha256 ~ '^[0-9a-f]{64}$');

create table app.organization_marks (
  organization_id uuid not null references app.organizations (id) on delete restrict,
  kind text not null check (kind in ('signature', 'stamp')),
  content_type text not null check (content_type in ('image/png', 'image/jpeg')),
  data bytea not null check (octet_length(data) between 1 and 524288),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  updated_by uuid not null references app.user_profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (organization_id, kind)
);

create index organization_marks_updated_by_idx on app.organization_marks (updated_by);

revoke all on app.organization_marks from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.organization_marks from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.organization_marks from authenticated';
  end if;
end
$$;

grant select, insert, update on app.organization_marks to nagaw_api;

alter table app.organization_marks enable row level security;

create policy api_access on app.organization_marks
  for all to nagaw_api using (true) with check (true);
