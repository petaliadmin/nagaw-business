-- Services next to products (ADR-045). A service has no stock: the database
-- guarantees it. Existing products stay products: nothing tells whether one
-- without stock is a service; the owner changes it in the product's form.

alter table app.products
  add column kind text not null default 'product'
    check (kind in ('product', 'service')),
  add constraint products_service_without_stock
    check (kind = 'product' or not track_stock);

alter table app.products drop constraint products_unit_check;
alter table app.products add constraint products_unit_check
  check (unit in ('piece', 'carton', 'paquet', 'sachet', 'bouteille', 'sac',
    'kg', 'g', 'litre', 'ml', 'metre',
    'prestation', 'forfait', 'heure', 'jour'));

alter table app.unit_templates drop constraint unit_templates_stock_unit_check;
alter table app.unit_templates add constraint unit_templates_stock_unit_check
  check (stock_unit in ('piece', 'carton', 'paquet', 'sachet', 'bouteille', 'sac',
    'kg', 'g', 'litre', 'ml', 'metre',
    'prestation', 'forfait', 'heure', 'jour'));
