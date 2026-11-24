-- Prices typed at each sale, and the sale of an amount (ADR-069).
--
-- `open_price`: a product whose price changes with the customer or the heap
-- (onions, fish): the seller types it at each sale; `sale_price` is only a
-- suggestion, 0 when there is none.
--
-- `system_role = 'open_sale'`: one product per shop, « Vente au montant »,
-- behind « Taper un montant » in the caisse. A sale of an amount is a sale
-- line like any other (ticket, stock, statistics, goods or services in the
-- accounts), with the words the seller typed as its label. The API keeps it
-- from being changed or archived, and it never counts in the plan's limit.

alter table app.products
  add column open_price boolean not null default false,
  add column system_role text check (system_role in ('open_sale', 'delivery_fee')),
  add constraint products_open_sale_shape
    check (system_role is null or (open_price and not track_stock));

create unique index products_org_system_role_key
  on app.products (organization_id, system_role) where system_role is not null;

-- Every existing shop gets its « Vente au montant », named after what it
-- sells. A product of the same name keeps its name: this one is renamed.
insert into app.products
  (organization_id, name, unit, sale_price, track_stock, kind, open_price,
   system_role, status, client_operation_id, created_by)
select o.id,
       case when exists (
              select 1 from app.products p
               where p.organization_id = o.id and p.status = 'active'
                 and lower(p.name) = 'vente au montant')
            then 'Vente au montant (caisse)' else 'Vente au montant' end,
       case when o.offer = 'services' then 'prestation' else 'piece' end,
       0, false,
       case when o.offer = 'services' then 'service' else 'product' end,
       true, 'open_sale', 'active', gen_random_uuid(), o.created_by
  from app.organizations o;
