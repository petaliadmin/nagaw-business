import type {
  CategoryColor,
  DocumentLine,
  InvoicePaymentMethod,
  InvoiceStatus,
  QuoteStatus,
  MobileMoneyProvider,
  PaymentMethod,
  ProductPhotoType,
  StockMovementKind,
  Unit,
} from '@nagaw/shared';
import type { ColumnType, Generated } from 'kysely';

/**
 * Kysely view of the `app` schema. Must mirror supabase/migrations — the SQL
 * migrations are the source of truth (ADR-004).
 */
type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>;

export interface UserProfilesTable {
  id: string;
  email: string;
  display_name: string | null;
  locale: Generated<string>;
  timezone: Generated<string>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface OrganizationsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  status: Generated<'active' | 'suspended'>;
  timezone: Generated<string>;
  default_currency: Generated<string>;
  invitation_ttl_hours: Generated<number>;
  max_pending_invitations: Generated<number>;
  max_products: Generated<number>;
  max_product_categories: Generated<number>;
  max_suppliers: Generated<number>;
  max_tax_rates: Generated<number>;
  seller_max_discount_basis_points: Generated<number>;
  max_customers: Generated<number>;
  next_sale_number: Generated<number>;
  max_offline_days: Generated<number>;
  max_devices: Generated<number>;
  next_device_number: Generated<number>;
  legal_name: Generated<string>;
  address: Generated<string>;
  phone: Generated<string>;
  email: Generated<string>;
  tax_id: Generated<string>;
  trade_register: Generated<string>;
  invoice_footer: Generated<string>;
  invoice_due_days: Generated<number>;
  quote_validity_days: Generated<number>;
  created_by: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface OrganizationMembershipsTable {
  id: Generated<string>;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: Generated<'active' | 'disabled'>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface OrganizationInvitationsTable {
  id: Generated<string>;
  organization_id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  token_hash: Buffer;
  status: Generated<'pending' | 'accepted' | 'revoked' | 'expired'>;
  invited_by: string;
  expires_at: Timestamp;
  accepted_by: string | null;
  accepted_at: NullableTimestamp;
  revoked_by: string | null;
  revoked_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AuditLogsTable {
  // bigint comes back from pg as a string.
  id: ColumnType<string, never, never>;
  organization_id: string | null;
  actor_type: 'user' | 'agent' | 'system' | 'platform_admin';
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: ColumnType<Record<string, unknown>, string | undefined, never>;
  request_id: string | null;
  created_at: ColumnType<Date, never, never>;
}

// numeric and bigint come back from pg as strings; inserts accept numbers.
type Numeric = ColumnType<string, number | string, number | string>;
type NullableNumeric = ColumnType<
  string | null,
  number | string | null | undefined,
  number | string | null
>;
type CatalogStatus = Generated<'active' | 'archived'>;

export interface TaxRatesTable {
  id: Generated<string>;
  organization_id: string;
  name: string;
  rate_basis_points: number;
  status: CatalogStatus;
  created_by: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProductCategoriesTable {
  id: Generated<string>;
  organization_id: string;
  name: string;
  color: Generated<CategoryColor>;
  status: CatalogStatus;
  created_by: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface SuppliersTable {
  id: Generated<string>;
  organization_id: string;
  name: string;
  phone: Generated<string>;
  notes: Generated<string>;
  status: CatalogStatus;
  created_by: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProductsTable {
  id: Generated<string>;
  organization_id: string;
  name: string;
  category_id: string | null;
  unit: Unit;
  sale_price: Numeric;
  purchase_price: NullableNumeric;
  tax_rate_id: string | null;
  barcode: string | null;
  track_stock: Generated<boolean>;
  low_stock_threshold: NullableNumeric;
  status: CatalogStatus;
  version: Generated<number>;
  photo_sha256: string | null;
  client_operation_id: string;
  created_by: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProductPhotosTable {
  organization_id: string;
  product_id: string;
  content_type: ProductPhotoType;
  data: Buffer;
  sha256: string;
  updated_by: string;
  updated_at: Timestamp;
}

export interface StockMovementsTable {
  id: Generated<string>;
  organization_id: string;
  product_id: string;
  kind: StockMovementKind;
  quantity: Numeric;
  counted_quantity: NullableNumeric;
  unit_cost: NullableNumeric;
  supplier_id: string | null;
  reason: string | null;
  sale_id: string | null;
  client_operation_id: string;
  created_by: string;
  occurred_at: Timestamp;
  created_at: ColumnType<Date, never, never>;
}

export interface CustomersTable {
  id: Generated<string>;
  organization_id: string;
  name: string;
  phone: Generated<string>;
  notes: Generated<string>;
  email: Generated<string>;
  address: Generated<string>;
  tax_id: Generated<string>;
  credit_limit: NullableNumeric;
  status: CatalogStatus;
  client_operation_id: string;
  created_by: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface SalesTable {
  id: Generated<string>;
  organization_id: string;
  sale_number: number;
  customer_id: string | null;
  seller_id: string;
  status: Generated<'completed' | 'cancelled'>;
  subtotal: Numeric;
  discount: Numeric;
  total: Numeric;
  tax_total: Numeric;
  cash_received: NullableNumeric;
  change_given: NullableNumeric;
  client_operation_id: string;
  occurred_at: Timestamp;
  cancelled_at: NullableTimestamp;
  cancelled_by: string | null;
  cancel_reason: string | null;
  device_id: string | null;
  device_ticket: string | null;
  price_review: Generated<boolean>;
  synced_at: NullableTimestamp;
  created_at: ColumnType<Date, never, never>;
}

export interface DevicesTable {
  id: Generated<string>;
  organization_id: string;
  user_id: string;
  label: string;
  ticket_prefix: string;
  client_operation_id: string;
  last_synced_at: NullableTimestamp;
  revoked_at: NullableTimestamp;
  revoked_by: string | null;
  created_at: ColumnType<Date, never, never>;
}

export interface SaleLinesTable {
  id: Generated<string>;
  organization_id: string;
  sale_id: string;
  position: number;
  product_id: string;
  label: string;
  unit: Unit;
  unit_price: Numeric;
  quantity: Numeric;
  line_total: Numeric;
  tax_rate_basis_points: number | null;
  tax_amount: Numeric;
}

export interface SalePaymentsTable {
  id: Generated<string>;
  organization_id: string;
  sale_id: string;
  method: PaymentMethod;
  provider: MobileMoneyProvider | null;
  reference: string | null;
  amount: Numeric;
}

export interface CustomerPaymentsTable {
  id: Generated<string>;
  organization_id: string;
  customer_id: string;
  method: 'cash' | 'mobile_money' | 'card';
  provider: MobileMoneyProvider | null;
  reference: string | null;
  amount: Numeric;
  client_operation_id: string;
  created_by: string;
  created_at: ColumnType<Date, never, never>;
}

// Dates are read back as text (no time-zone shift on calendar dates).
type CalendarDate = ColumnType<string, string, string>;
type NullableCalendarDate = ColumnType<
  string | null,
  string | null | undefined,
  string | null
>;
type Json<T> = ColumnType<T, string, string>;

export interface DocumentSequencesTable {
  organization_id: string;
  kind: 'quote' | 'invoice' | 'credit_note';
  year: number;
  next_number: Generated<number>;
}

export interface QuotesTable {
  id: Generated<string>;
  organization_id: string;
  number: string;
  customer_id: string;
  status: Generated<QuoteStatus>;
  issue_date: CalendarDate;
  valid_until: CalendarDate;
  lines: Json<DocumentLine[]>;
  notes: Generated<string>;
  subtotal: Numeric;
  discount: Numeric;
  total: Numeric;
  tax_total: Numeric;
  client_operation_id: string;
  created_by: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface InvoicesTable {
  id: Generated<string>;
  organization_id: string;
  kind: Generated<'invoice' | 'credit_note'>;
  number: string | null;
  status: Generated<InvoiceStatus>;
  customer_id: string;
  quote_id: string | null;
  sale_id: string | null;
  credit_for_id: string | null;
  issue_date: NullableCalendarDate;
  due_date: NullableCalendarDate;
  lines: Json<DocumentLine[]>;
  notes: Generated<string>;
  subtotal: Numeric;
  discount: Numeric;
  total: Numeric;
  tax_total: Numeric;
  issued_at: NullableTimestamp;
  issued_by: string | null;
  cancelled_at: NullableTimestamp;
  cancelled_by: string | null;
  cancel_reason: string | null;
  client_operation_id: string;
  created_by: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface InvoicePaymentsTable {
  id: Generated<string>;
  organization_id: string;
  invoice_id: string;
  method: InvoicePaymentMethod;
  provider: MobileMoneyProvider | null;
  reference: string | null;
  amount: Numeric;
  paid_on: CalendarDate;
  from_sale: Generated<boolean>;
  client_operation_id: string;
  created_by: string;
  created_at: ColumnType<Date, never, never>;
}

export interface Database {
  'app.user_profiles': UserProfilesTable;
  'app.organizations': OrganizationsTable;
  'app.organization_memberships': OrganizationMembershipsTable;
  'app.organization_invitations': OrganizationInvitationsTable;
  'app.audit_logs': AuditLogsTable;
  'app.tax_rates': TaxRatesTable;
  'app.product_categories': ProductCategoriesTable;
  'app.suppliers': SuppliersTable;
  'app.products': ProductsTable;
  'app.product_photos': ProductPhotosTable;
  'app.stock_movements': StockMovementsTable;
  'app.customers': CustomersTable;
  'app.sales': SalesTable;
  'app.sale_lines': SaleLinesTable;
  'app.sale_payments': SalePaymentsTable;
  'app.customer_payments': CustomerPaymentsTable;
  'app.devices': DevicesTable;
  'app.document_sequences': DocumentSequencesTable;
  'app.quotes': QuotesTable;
  'app.invoices': InvoicesTable;
  'app.invoice_payments': InvoicePaymentsTable;
}
