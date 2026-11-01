-- Country code of a shop's customers, for WhatsApp links: `wa.me` needs an
-- international number, and people type local ones. Senegal by default.

alter table app.organizations
  add column phone_country_code text not null default '221'
    check (phone_country_code ~ '^[1-9][0-9]{0,2}$');

comment on column app.organizations.phone_country_code is
  'Added to local phone numbers, without + or 00; set in the settings.';
