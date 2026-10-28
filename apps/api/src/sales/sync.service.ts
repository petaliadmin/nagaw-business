import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { roleHasPermission } from '@nagaw/shared';
import type {
  SyncOperation,
  SyncRequest,
  SyncResponseDto,
  SyncResultDto,
} from '@nagaw/shared';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { invalid } from '../catalog/catalog.errors.js';
import { StockService } from '../catalog/stock.service.js';
import { AlertsService } from '../notifications/alerts.service.js';
import { CustomersService } from './customers.service.js';
import { DevicesService } from './devices.service.js';
import { SalesService } from './sales.service.js';

/** A device clock may run a little fast. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Applies the operations a device recorded, in order (ADR-020). Each runs
 * in its own transaction: one refused operation never blocks the others,
 * and is answered with its reason so that the device shows it. A replayed
 * operation is answered `duplicate`, without effect.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly devices: DevicesService,
    private readonly sales: SalesService,
    private readonly customers: CustomersService,
    private readonly stock: StockService,
    private readonly alerts: AlertsService,
  ) {}

  async apply(
    tenant: TenantContext,
    user: AuthContext,
    request: SyncRequest,
    requestId: string | null,
  ): Promise<SyncResponseDto> {
    await this.devices.assertUsable(tenant, user, request.deviceId);
    const { max_offline_days } = await this.database.db
      .selectFrom('app.organizations')
      .select('max_offline_days')
      .where('id', '=', tenant.organizationId)
      .executeTakeFirstOrThrow();

    const results: SyncResultDto[] = [];
    const rejections: {
      operation: SyncOperation;
      code: string;
      message: string;
    }[] = [];
    for (const operation of request.operations) {
      try {
        results.push(
          await this.applyOne(tenant, user, request.deviceId, operation, {
            maxOfflineDays: max_offline_days,
            requestId,
          }),
        );
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        const { code, message } = describe(error);
        this.logger.warn(
          { requestId, code, operation: operation.clientOperationId },
          'Opération hors ligne refusée',
        );
        results.push({
          clientOperationId: operation.clientOperationId,
          status: 'rejected',
          error: { code, message },
        });
        rejections.push({ operation, code, message });
      }
    }
    await this.record(tenant, user, request.deviceId, results, rejections);
    await this.devices.touch(tenant.organizationId, request.deviceId);
    await this.alerts.flush(tenant.organizationId);
    return { results };
  }

  /** What the batch brought, for the platform's metrics (ADR-030). */
  private async record(
    tenant: TenantContext,
    user: AuthContext,
    deviceId: string,
    results: SyncResultDto[],
    rejections: { operation: SyncOperation; code: string; message: string }[],
  ): Promise<void> {
    const count = (status: SyncResultDto['status']) =>
      results.filter((r) => r.status === status).length;
    await this.database.db.transaction().execute(async (trx) => {
      const { id } = await trx
        .insertInto('app.sync_batches')
        .values({
          organization_id: tenant.organizationId,
          device_id: deviceId,
          user_id: user.userId,
          accepted: count('accepted'),
          duplicates: count('duplicate'),
          rejected: count('rejected'),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (rejections.length > 0)
        await trx
          .insertInto('app.sync_rejections')
          .values(
            rejections.map(({ operation, code, message }) => ({
              organization_id: tenant.organizationId,
              batch_id: id,
              client_operation_id: operation.clientOperationId,
              operation_type: operation.type,
              code: code.slice(0, 60),
              message: message.slice(0, 500),
            })),
          )
          .execute();
      // The managers learn the same day what a phone could not record.
      await this.alerts.syncRejected(trx, {
        organizationId: tenant.organizationId,
        userId: user.userId,
        userEmail: user.email ?? 'un vendeur',
        rejections: rejections.map(({ operation, message }) => ({
          label: labelOf(operation),
          message,
        })),
      });
    });
  }

  private async applyOne(
    tenant: TenantContext,
    user: AuthContext,
    deviceId: string,
    operation: SyncOperation,
    options: { maxOfflineDays: number; requestId: string | null },
  ): Promise<SyncResultDto> {
    if (operation.type === 'customer') {
      const { customer, replayed } = await this.customers.createAlone(
        tenant,
        user,
        { ...operation.data, clientOperationId: operation.clientOperationId },
        options.requestId,
      );
      return {
        clientOperationId: operation.clientOperationId,
        status: replayed ? 'duplicate' : 'accepted',
        customerId: customer.id,
      };
    }

    const occurredAt = new Date(operation.data.occurredAt);
    const age = Date.now() - occurredAt.getTime();
    if (age < -FUTURE_TOLERANCE_MS)
      throw invalid(
        'occurredAt',
        'La date de la vente est dans le futur : vérifiez l’heure du téléphone.',
      );
    if (age > options.maxOfflineDays * 24 * 60 * 60 * 1000)
      throw invalid(
        'occurredAt',
        `Opération de plus de ${options.maxOfflineDays} jours : elle doit être vérifiée par un gérant.`,
      );

    if (operation.type === 'stock_correction') {
      // A seller without the right gets the usual refusal, kept on the phone.
      if (!roleHasPermission(tenant.role, 'stock.correct'))
        throw new ApiException(
          HttpStatus.FORBIDDEN,
          'PERMISSION_DENIED',
          'Votre rôle ne permet pas de corriger le stock.',
        );
      const { stockQuantity, replayed } = await this.stock.correct(
        tenant,
        user,
        { ...operation.data, clientOperationId: operation.clientOperationId },
        options.requestId,
      );
      return {
        clientOperationId: operation.clientOperationId,
        status: replayed ? 'duplicate' : 'accepted',
        stockQuantity,
      };
    }

    const sale = operation.data;

    let customerId = sale.customerId;
    if (sale.customerOperationId) {
      const created = await this.database.db
        .selectFrom('app.customers')
        .select('id')
        .where('organization_id', '=', tenant.organizationId)
        .where('client_operation_id', '=', sale.customerOperationId)
        .executeTakeFirst();
      if (!created) throw invalid('customerOperationId', 'Client inconnu.');
      customerId = created.id;
    }

    const { sale: recorded, replayed } = await this.sales.create(
      tenant,
      user,
      {
        clientOperationId: operation.clientOperationId,
        customerId,
        lines: sale.lines.map(
          ({
            productId,
            productUnitId,
            conversion,
            quantity,
            agreedTotal,
          }) => ({
            productId,
            productUnitId,
            conversion,
            quantity,
            agreedTotal,
          }),
        ),
        discount: sale.discount,
        payments: sale.payments,
        cashReceived: sale.cashReceived,
        // Not used for a device sale: its own prices are kept.
        expectedTotal: 0,
      },
      options.requestId,
      {
        deviceId,
        deviceTicket: sale.deviceTicket,
        occurredAt,
        unitPrices: sale.lines.map((line) => line.unitPrice),
      },
    );
    return {
      clientOperationId: operation.clientOperationId,
      status: replayed ? 'duplicate' : 'accepted',
      saleId: recorded.id,
      saleNumber: recorded.saleNumber,
      priceReview: recorded.priceReview,
      stockReview: recorded.stockReview,
    };
  }
}

/** How a refused operation is named to the managers. */
function labelOf(operation: SyncOperation): string {
  switch (operation.type) {
    case 'sale':
      return `Vente ${operation.data.deviceTicket}`;
    case 'customer':
      return `Client ${operation.data.name}`;
    case 'stock_correction':
      return 'Correction de stock';
  }
}

/** Code and message of a refused operation, as the API would answer them. */
function describe(error: HttpException): { code: string; message: string } {
  if (error instanceof ApiException) {
    const details = (error.details ?? []) as { message?: string }[];
    const detail = details
      .map((d) => d.message)
      .filter(Boolean)
      .join(' ');
    return {
      code: error.code,
      message: detail ? `${error.message} ${detail}` : error.message,
    };
  }
  return { code: `HTTP_${error.getStatus()}`, message: error.message };
}
