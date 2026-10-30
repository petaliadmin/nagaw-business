-- A new shop sells products unless it says otherwise (ADR-047). A separate
-- migration: the one before may already be applied (ADR-043). Existing shops
-- keep what they have: nothing disappears from their screens.

alter table app.organizations alter column offer set default 'products';
