-- What a shop shows (ADR-067): the parts of the application it hides, and
-- whether a new product counts its stock before the owner chooses. A display
-- setting like the offer (ADR-047): the API refuses nothing and hidden data
-- stays. Existing shops hide nothing and count stock, as before.

alter table app.organizations
  add column hidden_sections text[] not null default '{}'
    constraint organizations_hidden_sections_check check (
      hidden_sections <@ array['credit', 'customers', 'documents', 'suppliers',
        'expenses', 'reports', 'team']::text[]
    ),
  add column counts_stock_by_default boolean not null default true;
