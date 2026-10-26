-- Product limits of the offers (owner's decision, 2026-10-26; ADR-033).
--
-- Gratuit 3 products, Essentiel 10, Pro without limit. « Without limit »
-- is a null cap, in the offer and in the shop: no number stands for it.
-- Shops keep the products they already have; a lower cap only stops new
-- ones (ADR-029).

alter table app.plans alter column max_products drop not null;
alter table app.organizations alter column max_products drop not null;

comment on column app.plans.max_products is
  'Active products a shop may have; null: no limit.';
comment on column app.organizations.max_products is
  'Copied from the offer (subscriptions_apply_plan); null: no limit.';

update app.plans set max_products = 3 where key = 'free';
update app.plans set max_products = 10 where key = 'essential';
update app.plans set max_products = null where key = 'pro';

-- Every shop takes the new cap of its offer.
update app.organizations o
   set max_products = p.max_products
  from app.subscriptions s
  join app.plans p on p.key = s.plan_key
 where s.organization_id = o.id;
