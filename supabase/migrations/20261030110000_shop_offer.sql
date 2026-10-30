-- What a shop sells, which adapts its screens (ADR-047). Existing shops see
-- everything, as before, until they choose.

alter table app.organizations
  add column offer text not null default 'both'
    check (offer in ('products', 'services', 'both'));
