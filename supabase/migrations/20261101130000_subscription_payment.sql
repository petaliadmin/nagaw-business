-- Where a shop pays its offer until online payment exists (owner's decision,
-- 2026-11-01; ADR-056). Numbers in the database: a change needs no release.
-- Null: this way of paying is not offered.

alter table app.platform_settings
  add column payment_wave_number text
    check (payment_wave_number ~ '^[0-9 ]{8,20}$'),
  add column payment_orange_money_number text
    check (payment_orange_money_number ~ '^[0-9 ]{8,20}$');

update app.platform_settings set payment_wave_number = '76 905 58 52';
