import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  formatAmount,
  type AdminDataItemDto,
  type AdminDataKind,
  type AdminDataQuery,
} from '@nagaw/shared';
import { AuditService } from '../audit/audit.service.js';
import {
  conflict,
  notFound,
  toNumber,
  UUID_RE,
} from '../catalog/catalog.errors.js';
import { ProductsService } from '../catalog/products.service.js';
import { ApiException } from '../common/api-exception.js';
import { ReferencesService } from '../catalog/references.service.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { CustomersService } from '../sales/customers.service.js';
import { SalesService } from '../sales/sales.service.js';

/** Rows listed at once: a search narrows them. */
const SHOWN = 100;

const shopNotFound = () => notFound('SHOP_NOT_FOUND', 'Boutique introuvable.');

/**
 * The data of a shop, from the administration (ADR-074), once entered with
 * a reason (ADR-040): archive or restore
 * its products, customers, suppliers and categories, cancel its sales and
 * invoices. Each change goes through the shop's own service, with its rules
 * (stock, credit, credit notes), as its owner would make it; the history
 * records it as done by the platform, with the reason.
 */
@Injectable()
export class AdminDataService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly products: ProductsService,
    private readonly references: ReferencesService,
    private readonly customers: CustomersService,
    private readonly sales: SalesService,
    private readonly documents: DocumentsService,
  ) {}

  /**
   * The shop, once the administrator has entered it with a reason
   * (ADR-040): its business content is never open otherwise.
   */
  private async shop(id: string, adminId: string) {
    if (!UUID_RE.test(id)) throw shopNotFound();
    const shop = await this.database.db
      .selectFrom('app.organizations')
      .select(['id', 'default_currency', 'status'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!shop) throw shopNotFound();
    const access = await this.database.db
      .selectFrom('app.platform_shop_accesses')
      .select('id')
      .where('organization_id', '=', id)
      .where('admin_id', '=', adminId)
      .where('closed_at', 'is', null)
      .executeTakeFirst();
    if (!access)
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'SHOP_ACCESS_REQUIRED',
        'Entrez d’abord dans la boutique, avec un motif : ses données ne s’ouvrent qu’ainsi.',
      );
    return shop;
  }

  async list(
    admin: AuthContext,
    shopId: string,
    kind: AdminDataKind,
    query: AdminDataQuery,
  ): Promise<AdminDataItemDto[]> {
    const shop = await this.shop(shopId, admin.userId);
    const money = (minor: unknown) =>
      formatAmount(toNumber(minor as string), shop.default_currency);
    const closed = query.closed === 'true';
    const like = query.q
      ? `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
      : null;
    const db = this.database.db;
    switch (kind) {
      case 'products': {
        let q = db
          .selectFrom('app.products')
          .select(['id', 'name', 'status', 'sale_price', 'kind', 'created_at'])
          .where('organization_id', '=', shopId)
          .where('system_role', 'is', null)
          .where('status', '=', closed ? 'archived' : 'active');
        if (like) q = q.where('name', 'ilike', like);
        const rows = await q.orderBy('name').limit(SHOWN).execute();
        return rows.map((r) => ({
          id: r.id,
          label: r.name,
          detail: `${r.kind === 'service' ? 'Service' : 'Produit'} · ${money(r.sale_price)}`,
          closed,
          action: closed ? 'restore' : 'archive',
          createdAt: r.created_at.toISOString(),
        }));
      }
      case 'customers': {
        let q = db
          .selectFrom('app.customers')
          .select(['id', 'name', 'phone', 'status', 'created_at'])
          .where('organization_id', '=', shopId)
          .where('status', '=', closed ? 'archived' : 'active');
        if (like) q = q.where('name', 'ilike', like);
        const rows = await q.orderBy('name').limit(SHOWN).execute();
        return rows.map((r) => ({
          id: r.id,
          label: r.name,
          detail: r.phone || 'Sans téléphone',
          closed,
          action: closed ? 'restore' : 'archive',
          createdAt: r.created_at.toISOString(),
        }));
      }
      case 'suppliers':
      case 'categories': {
        const table =
          kind === 'suppliers' ? 'app.suppliers' : 'app.product_categories';
        let q = db
          .selectFrom(table)
          .select(['id', 'name', 'status', 'created_at'])
          .where('organization_id', '=', shopId)
          .where('status', '=', closed ? 'archived' : 'active');
        if (like) q = q.where('name', 'ilike', like);
        const rows = await q.orderBy('name').limit(SHOWN).execute();
        return rows.map((r) => ({
          id: r.id,
          label: r.name,
          detail: kind === 'suppliers' ? 'Fournisseur' : 'Catégorie',
          closed,
          action: closed ? 'restore' : 'archive',
          createdAt: r.created_at.toISOString(),
        }));
      }
      case 'sales': {
        let q = db
          .selectFrom('app.sales as s')
          .leftJoin('app.customers as c', (join) =>
            join
              .onRef('c.organization_id', '=', 's.organization_id')
              .onRef('c.id', '=', 's.customer_id'),
          )
          .select([
            's.id',
            's.sale_number',
            's.device_ticket',
            's.total',
            's.occurred_at',
            'c.name as customer_name',
          ])
          .where('s.organization_id', '=', shopId)
          .where('s.status', '=', closed ? 'cancelled' : 'completed');
        if (query.q) {
          const n = Number(query.q.replace(/\D/g, ''));
          q = q.where((eb) =>
            eb.or([
              eb('c.name', 'ilike', like!),
              ...(Number.isInteger(n) && n > 0
                ? [eb('s.sale_number', '=', n)]
                : []),
              eb('s.device_ticket', 'ilike', like!),
            ]),
          );
        }
        const rows = await q
          .orderBy('s.occurred_at', 'desc')
          .limit(SHOWN)
          .execute();
        return rows.map((r) => ({
          id: r.id,
          label: `Ticket n° ${r.device_ticket ?? r.sale_number}`,
          detail: `${money(r.total)}${r.customer_name ? ` · ${r.customer_name}` : ''}`,
          closed,
          action: closed ? null : 'cancel',
          createdAt: r.occurred_at.toISOString(),
        }));
      }
      case 'invoices': {
        let q = db
          .selectFrom('app.invoices as i')
          .innerJoin('app.customers as c', (join) =>
            join
              .onRef('c.organization_id', '=', 'i.organization_id')
              .onRef('c.id', '=', 'i.customer_id'),
          )
          .select([
            'i.id',
            'i.number',
            'i.status',
            'i.total',
            'i.created_at',
            'c.name as customer_name',
          ])
          .where('i.organization_id', '=', shopId)
          .where('i.kind', '=', 'invoice')
          .where('i.status', closed ? '=' : '<>', 'cancelled');
        if (like)
          q = q.where((eb) =>
            eb.or([eb('c.name', 'ilike', like), eb('i.number', 'ilike', like)]),
          );
        const rows = await q
          .orderBy('i.created_at', 'desc')
          .limit(SHOWN)
          .execute();
        return rows.map((r) => ({
          id: r.id,
          label: r.number ? `Facture ${r.number}` : 'Facture brouillon',
          detail: `${money(r.total)} · ${r.customer_name}`,
          closed,
          // A draft is removed by its shop; an issued one is cancelled by
          // a credit note (ADR-026).
          action: !closed && r.status === 'issued' ? 'cancel' : null,
          createdAt: r.created_at.toISOString(),
        }));
      }
    }
  }

  /** Archive, restore or cancel one item, with the reason. */
  async act(
    admin: AuthContext,
    shopId: string,
    kind: AdminDataKind,
    itemId: string,
    action: 'archive' | 'restore' | 'cancel',
    reason: string,
    requestId: string | null,
  ): Promise<void> {
    await this.shop(shopId, admin.userId);
    if (!UUID_RE.test(itemId))
      throw notFound('NOT_FOUND', 'Élément introuvable.');
    // The platform acts as the owner would; the history says it is the
    // platform (audit trigger of ADR-040).
    const tenant: TenantContext = { organizationId: shopId, role: 'owner' };
    const status = action === 'archive' ? 'archived' : 'active';
    const wrong = () =>
      conflict('ACTION_NOT_POSSIBLE', 'Cette action ne s’applique pas ici.');
    switch (kind) {
      case 'products': {
        if (action === 'cancel') throw wrong();
        const { version } = await this.products.get(
          tenant.organizationId,
          itemId,
        );
        await this.products.update(
          tenant,
          admin,
          itemId,
          { status, version },
          requestId,
        );
        break;
      }
      case 'customers':
        if (action === 'cancel') throw wrong();
        await this.customers.update(
          tenant,
          admin,
          itemId,
          { status },
          requestId,
        );
        break;
      case 'suppliers':
        if (action === 'cancel') throw wrong();
        await this.references.updateSupplier(
          tenant,
          admin,
          itemId,
          { status },
          requestId,
        );
        break;
      case 'categories':
        if (action === 'cancel') throw wrong();
        await this.references.updateCategory(
          tenant,
          admin,
          itemId,
          { status },
          requestId,
        );
        break;
      case 'sales':
        if (action !== 'cancel') throw wrong();
        await this.sales.cancel(tenant, admin, itemId, { reason }, requestId);
        break;
      case 'invoices':
        if (action !== 'cancel') throw wrong();
        await this.documents.cancelInvoice(
          tenant,
          admin,
          itemId,
          { reason, clientOperationId: randomUUID() },
          requestId,
        );
        break;
    }
    // Why the platform did it, beside the shop's own entry.
    await this.audit.record(this.database.db, {
      organizationId: shopId,
      actorType: 'platform_admin',
      actorId: admin.userId,
      action: 'platform.data_changed',
      targetType: kind,
      targetId: itemId,
      metadata: { kind, action, reason },
      requestId,
    });
  }
}
