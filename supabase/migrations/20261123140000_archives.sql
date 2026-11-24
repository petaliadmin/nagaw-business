-- Archive a shop or an account from the administration (ADR-074).
--
-- Archiving hides and closes, it never erases: sales, invoices and the
-- history stay, for the accounts and the law, and the platform restores.

alter table app.organizations
  drop constraint organizations_status_check,
  add constraint organizations_status_check
    check (status in ('active', 'suspended', 'archived')),
  add column archived_at timestamptz,
  add column archived_by uuid references app.user_profiles (id) on delete restrict,
  add column archive_reason text check (char_length(archive_reason) between 1 and 300),
  add constraint organizations_archive_shape
    check ((status = 'archived') = (archived_at is not null and archived_by is not null
                                    and archive_reason is not null));

create index organizations_archived_by_idx on app.organizations (archived_by)
  where archived_by is not null;

-- An archived account can no longer sign in, in any of its shops.
alter table app.user_profiles
  add column archived_at timestamptz,
  add column archived_by uuid references app.user_profiles (id) on delete restrict,
  add column archive_reason text check (char_length(archive_reason) between 1 and 300),
  add constraint user_profiles_archive_shape
    check ((archived_at is null) = (archived_by is null)
           and (archived_at is null) = (archive_reason is null));

create index user_profiles_archived_by_idx on app.user_profiles (archived_by)
  where archived_by is not null;
