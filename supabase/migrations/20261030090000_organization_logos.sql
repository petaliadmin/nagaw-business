-- A shop's logo and colour, on its quotes, invoices and tickets (ADR-044).
-- The logo has the shape of the product photos: small, resized on the
-- device, and only PNG or JPEG, the two formats a PDF can embed. Removing a
-- logo only clears the pointer.

alter table app.organizations
  add column logo_sha256 text check (logo_sha256 ~ '^[0-9a-f]{64}$'),
  add column document_color text not null default '#6d28d9'
    check (document_color ~ '^#[0-9a-f]{6}$');

create table app.organization_logos (
  organization_id uuid primary key references app.organizations (id) on delete restrict,
  content_type text not null check (content_type in ('image/png', 'image/jpeg')),
  data bytea not null check (octet_length(data) between 1 and 524288),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  updated_by uuid not null references app.user_profiles (id) on delete restrict,
  updated_at timestamptz not null default now()
);

create index organization_logos_updated_by_idx on app.organization_logos (updated_by);

revoke all on app.organization_logos from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.organization_logos from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.organization_logos from authenticated';
  end if;
end
$$;

grant select, insert, update on app.organization_logos to nagaw_api;

alter table app.organization_logos enable row level security;

create policy api_access on app.organization_logos
  for all to nagaw_api using (true) with check (true);
