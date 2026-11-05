-- Profile of the shop and the modules it shows (ADR-062, Phase 19).
--
-- The shop answers a few questions once (activity, how it sells, what it
-- wants first, team size); its menu then shows only what serves it. Hiding a
-- module removes nothing and refuses nothing: the screens stay reachable and
-- the shop can show them again in Settings.

-- Modules a shop may hide. Selling, products, customers, treasury and the
-- settings are always shown.
alter table app.organizations
  add column profile_status text not null default 'pending'
    check (profile_status in ('pending', 'answered', 'skipped')),
  add column hidden_modules text[] not null default '{}'
    check (hidden_modules <@ array['documents', 'suppliers', 'expenses', 'stats', 'accounting']::text[]);

-- Answers offered by the questionnaire, with the modules each one shows.
-- In the database so that an activity or a goal is added without a release:
-- version 1.2 adds schools and rentals as rows here.
create table app.profile_choices (
  kind text not null check (kind in ('sector', 'goal')),
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  label text not null check (char_length(label) between 2 and 80),
  position integer not null,
  modules text[] not null default '{}'
    check (modules <@ array['documents', 'suppliers', 'expenses', 'stats', 'accounting']::text[]),
  active boolean not null default true,
  primary key (kind, key)
);

insert into app.profile_choices (kind, key, label, position, modules) values
  ('sector', 'neighbourhood', 'Boutique de quartier', 10, array['suppliers', 'expenses', 'stats']),
  ('sector', 'fashion_beauty', 'Mode et beauté', 20, array['suppliers', 'expenses', 'stats']),
  ('sector', 'electronics', 'Électronique et téléphones', 30, array['documents', 'suppliers', 'expenses', 'stats']),
  ('sector', 'food', 'Alimentation', 40, array['suppliers', 'expenses', 'stats']),
  ('sector', 'pharmacy', 'Pharmacie', 50, array['documents', 'suppliers', 'expenses', 'stats', 'accounting']),
  ('sector', 'hardware', 'Quincaillerie', 60, array['documents', 'suppliers', 'expenses', 'stats']),
  ('sector', 'restaurant', 'Restaurant', 70, array['suppliers', 'expenses', 'stats']),
  ('sector', 'services', 'Services', 80, array['documents', 'expenses', 'stats']),
  ('sector', 'other', 'Autre', 90, array['documents', 'suppliers', 'expenses', 'stats', 'accounting']),
  ('goal', 'profit', 'Savoir ce que je gagne', 10, array['expenses', 'stats']),
  ('goal', 'credit', 'Suivre qui me doit', 20, array[]::text[]),
  ('goal', 'stock', 'Gérer mon stock', 30, array['suppliers']),
  ('goal', 'documents', 'Faire des factures et des devis', 40, array['documents']),
  ('goal', 'accounting', 'Préparer ma comptabilité', 50, array['accounting', 'expenses']);

-- The answers of a shop. Goals are checked by the API against the active
-- choices (an array cannot carry a foreign key).
create table app.organization_profiles (
  organization_id uuid primary key
    references app.organizations (id) on delete restrict,
  sector_kind text not null default 'sector' check (sector_kind = 'sector'),
  sector text,
  channels text[] not null default '{}'
    check (channels <@ array['counter', 'social', 'delivery']::text[]),
  goals text[] not null default '{}',
  team_size text check (team_size in ('solo', 'small', 'large')),
  answered_by uuid not null references app.user_profiles (id) on delete restrict,
  answered_at timestamptz not null default now(),
  foreign key (sector_kind, sector)
    references app.profile_choices (kind, key) on delete restrict
);

revoke all on app.profile_choices, app.organization_profiles from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.profile_choices, app.organization_profiles from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on app.profile_choices, app.organization_profiles from authenticated';
  end if;
end
$$;

-- Choices are reference data: the API reads them, the platform edits them
-- in SQL.
grant select on app.profile_choices to nagaw_api;
grant select, insert, update on app.organization_profiles to nagaw_api;

alter table app.profile_choices enable row level security;
create policy api_access on app.profile_choices
  for select to nagaw_api using (true);

alter table app.organization_profiles enable row level security;
create policy api_access on app.organization_profiles
  for all to nagaw_api using (true) with check (true);
