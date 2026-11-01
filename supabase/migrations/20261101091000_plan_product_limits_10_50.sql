-- Product limits of the offers (owner's decision, 2026-11-01; ADR-054).
--
-- Gratuit 10 products, Essentiel 50, Pro still without limit. Shops keep
-- everything they have (ADR-029); the caps only go up here.

update app.plans set max_products = 10 where key = 'free';
update app.plans set max_products = 50 where key = 'essential';

-- Every shop takes the new cap of its offer.
update app.organizations o
   set max_products = p.max_products
  from app.subscriptions s
  join app.plans p on p.key = s.plan_key
 where s.organization_id = o.id;
