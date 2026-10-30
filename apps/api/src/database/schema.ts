import type {
  CategoryColor,
  DocumentLine,
  InvoicePaymentMethod,
  InvoiceStatus,
  QuoteStatus,
  MobileMoneyProvider,
  NotificationCategory,
  NotificationSeverity,
  PaymentMethod,
  ProductKind,
  ProductPhotoType,
  ShopLogoType,
  ShopMarkKind,
  ShopOffer,
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
  /** Null: no limit (offer without one, ADR-033). */
  max_products: Generated<number | null>;
  max_product_categories: Generated<number>;
  max_suppliers: Generated<number>;
  max_tax_rates: Generated<number>;
  max_product_units: Generated<number>;
  max_unit_templates: Generated<number>;
  seller_can_sell_below_cost: Generated<boolean>;
  max_customers: Generated<number>;
  next_sale_number: Generated<number>;
  max_offline_days: Generated<number>;
  max_devices: Generated<number>;
  max_expense_categories: Generated<number>;
  max_members: Generated<number>;
  suspended_at: NullableTimestamp;
  suspension_reason: string | null;
  next_device_number: Generated<number>;
  legal_name: Generated<string>;
  address: Generated<string>;
  phone: Generated<string>;
  email: Generated<string>;
  tax_id: Generated<string>;
  logo_sha256: Generated<string | null>;
  signature_sha256: Generated<string | null>;
  stamp_sha256: Generated<string | null>;
  document_color: Generated<string>;
  offer: Generated<ShopOffer>;
  trade_register: Generated<string>;
  invoice_footer: Generated<string>;
  invoice_due_days: Generated<number>;
  quote_validity_days: Generated<number>;
  seller_stock_correction_max: ColumnType<
    string,
    number | string | undefined,
    number | string
  >;
  stock_forecast_days: Generated<number>;
  stock_forecast_window_days: Generated<number>;
  credit_overdue_days: Generated<number>;
  credit_near_limit_percent: Generated<number>;
  daily_summary_hour: Generated<number>;
  /** Read it as text (`daily_run_on::text`): pg returns a Date. */
  daily_run_on: ColumnType<
    Date | null,
    string | null | undefined,
    string | null
  >;
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
  max_discount_basis_points: number | null;
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
  kind: Generated<ProductKind>;
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

export interface ProductUnitsTable {
  id: Generated<string>;
  organization_id: string;
  product_id: string;
  label: string;
  factor: Numeric;
  sale_price: NullableNumeric;
  allows_decimals: Generated<boolean>;
  barcode: string | null;
  status: CatalogStatus;
  version: Generated<number>;
  client_operation_id: string;
  created_by: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface UnitTemplatesTable {
  id: Generated<string>;
  organization_id: string;
  label: string;
  stock_unit: Unit;
  factor: Numeric;
  allows_decimals: Generated<boolean>;
  status: CatalogStatus;
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

export interface OrganizationLogosTable {
  organization_id: string;
  content_type: ShopLogoType;
  data: Buffer;
  sha256: string;
  updated_by: string;
  updated_at: Timestamp;
}

export interface OrganizationMarksTable {
  organization_id: string;
  kind: ShopMarkKind;
  content_type: ShopLogoType;
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
  stock_review: Generated<boolean>;
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
  product_unit_id: string | null;
  unit_label: string | null;
  unit_factor: ColumnType<string, number | string | undefined, never>;
  base_quantity: ColumnType<string, never, never>;
  price_basis: ColumnType<
    'unit' | 'stock',
    'unit' | 'stock' | undefined,
    never
  >;
  unit_price: Numeric;
  quantity: Numeric;
  list_total: NullableNumeric;
  line_total: Numeric;
  tax_rate_basis_points: number | null;
  tax_amount: Numeric;
  unit_cost: NullableNumeric;
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
  kind: 'quote' | 'invoice' | 'credit_note' | 'expense';
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

export interface CashAccountsTable {
  id: Generated<string>;
  organization_id: string;
  kind: 'cash' | 'mobile_money' | 'bank';
  provider: MobileMoneyProvider | null;
  name: string;
  opening_balance: ColumnType<
    string,
    number | string | undefined,
    number | string
  >;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, never>;
}

export interface ExpenseCategoriesTable {
  id: Generated<string>;
  organization_id: string;
  name: string;
  account_code: string;
  status: Generated<'active' | 'archived'>;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, never>;
}

export interface ExpensesTable {
  id: Generated<string>;
  organization_id: string;
  number: string;
  category_id: string;
  cash_account_id: string;
  label: string;
  amount: Numeric;
  occurred_on: CalendarDate;
  status: Generated<'recorded' | 'cancelled'>;
  cancelled_at: NullableTimestamp;
  cancelled_by: string | null;
  cancel_reason: string | null;
  client_operation_id: string;
  created_by: string;
  created_at: ColumnType<Date, never, never>;
}

export interface CashTransfersTable {
  id: Generated<string>;
  organization_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: Numeric;
  occurred_on: CalendarDate;
  note: Generated<string>;
  client_operation_id: string;
  created_by: string;
  created_at: ColumnType<Date, never, never>;
}

export interface CashClosingsTable {
  id: Generated<string>;
  organization_id: string;
  cash_account_id: string;
  day: CalendarDate;
  expected_amount: Numeric;
  counted_amount: Numeric;
  difference: Numeric;
  note: Generated<string>;
  client_operation_id: string;
  closed_by: string;
  created_at: ColumnType<Date, never, never>;
}

export interface ExpenseReceiptsTable {
  organization_id: string;
  expense_id: string;
  content_type: ProductPhotoType;
  data: Buffer;
  sha256: string;
  updated_by: string;
  updated_at: Timestamp;
}

export interface PlansTable {
  key: string;
  name: string;
  monthly_price: Numeric;
  currency: string;
  /** Null: no limit (ADR-033). */
  max_products: number | null;
  max_members: number;
  max_devices: number;
  position: number;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, never>;
}

export interface SubscriptionsTable {
  organization_id: string;
  plan_key: string;
  started_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, never>;
  changed_by: string | null;
}

export interface PlanChangeRequestsTable {
  id: Generated<string>;
  organization_id: string;
  plan_key: string;
  status: Generated<'pending' | 'cancelled' | 'done' | 'rejected'>;
  requested_by: string;
  created_at: ColumnType<Date, never, never>;
  resolved_at: NullableTimestamp;
  resolved_by: string | null;
  resolution_note: Generated<string>;
}

export interface PlatformAdminsTable {
  user_id: string;
  note: Generated<string>;
  created_at: ColumnType<Date, never, never>;
}

export interface PlatformShopAccessesTable {
  id: Generated<string>;
  organization_id: string;
  admin_id: string;
  reason: string;
  opened_at: ColumnType<Date, never, never>;
  closed_at: NullableTimestamp;
}

export interface PlatformSettingsTable {
  id: Generated<boolean>;
  rejection_alert_basis_points: number;
  quota_alert_basis_points: number;
  silent_device_days: number;
  updated_at: ColumnType<Date, never, never>;
}

export interface SyncBatchesTable {
  id: Generated<string>;
  organization_id: string;
  device_id: string;
  user_id: string;
  accepted: number;
  duplicates: number;
  rejected: number;
  received_at: ColumnType<Date, never, never>;
}

export interface SyncRejectionsTable {
  id: Generated<string>;
  organization_id: string;
  batch_id: string;
  client_operation_id: string;
  operation_type: 'sale' | 'customer' | 'stock_correction';
  code: string;
  message: string;
  created_at: ColumnType<Date, never, never>;
}

export interface FeedbackTable {
  id: Generated<string>;
  organization_id: string;
  author_id: string;
  kind: 'problem' | 'idea' | 'question';
  message: string;
  page: Generated<string>;
  status: Generated<'new' | 'read' | 'done'>;
  answer: Generated<string>;
  answered_at: NullableTimestamp;
  answered_by: string | null;
  client_operation_id: string;
  created_at: ColumnType<Date, never, never>;
}

export interface NotificationsTable {
  id: Generated<string>;
  organization_id: string;
  recipient_id: string;
  category: NotificationCategory;
  kind: string;
  severity: Generated<NotificationSeverity>;
  title: string;
  body: Generated<string>;
  link: string | null;
  group_key: string;
  occurrences: Generated<number>;
  data: Json<Record<string, unknown>>;
  push_status: Generated<'none' | 'pending' | 'sent' | 'failed'>;
  read_at: NullableTimestamp;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, never>;
}

export interface NotificationPreferencesTable {
  organization_id: string;
  user_id: string;
  category: NotificationCategory;
  enabled: boolean;
  push: boolean;
  updated_at: ColumnType<Date, never, never>;
}

export interface PushSubscriptionsTable {
  id: Generated<string>;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  label: Generated<string>;
  failure_count: Generated<number>;
  last_success_at: NullableTimestamp;
  disabled_at: NullableTimestamp;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, never>;
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
  'app.product_units': ProductUnitsTable;
  'app.unit_templates': UnitTemplatesTable;
  'app.product_photos': ProductPhotosTable;
  'app.organization_logos': OrganizationLogosTable;
  'app.organization_marks': OrganizationMarksTable;
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
  'app.cash_accounts': CashAccountsTable;
  'app.expense_categories': ExpenseCategoriesTable;
  'app.expenses': ExpensesTable;
  'app.cash_transfers': CashTransfersTable;
  'app.cash_closings': CashClosingsTable;
  'app.expense_receipts': ExpenseReceiptsTable;
  'app.plans': PlansTable;
  'app.subscriptions': SubscriptionsTable;
  'app.plan_change_requests': PlanChangeRequestsTable;
  'app.platform_admins': PlatformAdminsTable;
  'app.platform_shop_accesses': PlatformShopAccessesTable;
  'app.platform_settings': PlatformSettingsTable;
  'app.sync_batches': SyncBatchesTable;
  'app.sync_rejections': SyncRejectionsTable;
  'app.feedback': FeedbackTable;
  'app.notifications': NotificationsTable;
  'app.notification_preferences': NotificationPreferencesTable;
  'app.push_subscriptions': PushSubscriptionsTable;
}
