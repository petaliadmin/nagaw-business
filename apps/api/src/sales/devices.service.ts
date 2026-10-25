import { HttpStatus, Injectable } from '@nestjs/common';
import {
  deviceTicketPrefix,
  roleHasPermission,
  type DeviceDto,
  type RegisterDeviceInput,
} from '@nagaw/shared';
import { AuditService } from '../audit/audit.service.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import {
  conflict,
  limitReached,
  notFound,
  UUID_RE,
  type Executor,
} from '../catalog/catalog.errors.js';

function deviceNotFound(): ApiException {
  return notFound('DEVICE_NOT_FOUND', 'Appareil introuvable.');
}

/**
 * Devices allowed to sell offline (ADR-020). Each has its own ticket
 * prefix; a manager can revoke a lost or stolen one.
 */
@Injectable()
export class DevicesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  private select(executor: Executor, organizationId: string) {
    return executor
      .selectFrom('app.devices as d')
      .innerJoin('app.user_profiles as u', 'u.id', 'd.user_id')
      .select([
        'd.id',
        'd.label',
        'd.ticket_prefix',
        'd.user_id',
        'u.email',
        'd.last_synced_at',
        'd.revoked_at',
        'd.created_at',
      ])
      .where('d.organization_id', '=', organizationId);
  }

  private toDto(
    row: Awaited<
      ReturnType<ReturnType<DevicesService['select']>['execute']>
    >[number],
  ): DeviceDto {
    return {
      id: row.id,
      label: row.label,
      ticketPrefix: row.ticket_prefix,
      user: { userId: row.user_id, email: row.email },
      lastSyncedAt: row.last_synced_at?.toISOString() ?? null,
      revokedAt: row.revoked_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    };
  }

  /** Managers see every device of the shop; others only theirs. */
  async list(tenant: TenantContext, user: AuthContext): Promise<DeviceDto[]> {
    let query = this.select(this.database.db, tenant.organizationId).orderBy(
      'd.created_at',
    );
    if (!roleHasPermission(tenant.role, 'devices.manage'))
      query = query.where('d.user_id', '=', user.userId);
    return (await query.execute()).map((row) => this.toDto(row));
  }

  async register(
    tenant: TenantContext,
    user: AuthContext,
    input: RegisterDeviceInput,
    requestId: string | null,
  ): Promise<{ device: DeviceDto; replayed: boolean }> {
    return this.database.db.transaction().execute(async (trx) => {
      const org = await trx
        .selectFrom('app.organizations')
        .select(['max_devices', 'next_device_number'])
        .where('id', '=', tenant.organizationId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const existing = await trx
        .selectFrom('app.devices')
        .select(['id', 'user_id'])
        .where('organization_id', '=', tenant.organizationId)
        .where('client_operation_id', '=', input.clientOperationId)
        .executeTakeFirst();
      if (existing) {
        if (existing.user_id !== user.userId)
          throw conflict(
            'OPERATION_ID_REUSED',
            'Cet identifiant d’opération a déjà servi.',
          );
        const row = await this.select(trx, tenant.organizationId)
          .where('d.id', '=', existing.id)
          .executeTakeFirstOrThrow();
        return { device: this.toDto(row), replayed: true };
      }
      const { count } = await trx
        .selectFrom('app.devices')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('organization_id', '=', tenant.organizationId)
        .where('revoked_at', 'is', null)
        .executeTakeFirstOrThrow();
      if (Number(count) >= org.max_devices)
        throw limitReached('appareils', org.max_devices, true);
      const { id } = await trx
        .insertInto('app.devices')
        .values({
          organization_id: tenant.organizationId,
          user_id: user.userId,
          label: input.label,
          ticket_prefix: deviceTicketPrefix(org.next_device_number),
          client_operation_id: input.clientOperationId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await trx
        .updateTable('app.organizations')
        .set({ next_device_number: org.next_device_number + 1 })
        .where('id', '=', tenant.organizationId)
        .execute();
      await this.audit.record(trx, {
        organizationId: tenant.organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'device.registered',
        targetType: 'device',
        targetId: id,
        metadata: { label: input.label },
        requestId,
      });
      const row = await this.select(trx, tenant.organizationId)
        .where('d.id', '=', id)
        .executeTakeFirstOrThrow();
      return { device: this.toDto(row), replayed: false };
    });
  }

  async revoke(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
    requestId: string | null,
  ): Promise<DeviceDto> {
    if (!UUID_RE.test(id)) throw deviceNotFound();
    return this.database.db.transaction().execute(async (trx) => {
      const device = await trx
        .selectFrom('app.devices')
        .select(['id', 'revoked_at'])
        .where('organization_id', '=', tenant.organizationId)
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!device) throw deviceNotFound();
      if (!device.revoked_at) {
        await trx
          .updateTable('app.devices')
          .set({ revoked_at: new Date(), revoked_by: user.userId })
          .where('organization_id', '=', tenant.organizationId)
          .where('id', '=', id)
          .execute();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'device.revoked',
          targetType: 'device',
          targetId: id,
          requestId,
        });
      }
      const row = await this.select(trx, tenant.organizationId)
        .where('d.id', '=', id)
        .executeTakeFirstOrThrow();
      return this.toDto(row);
    });
  }

  /**
   * The device that sends a batch must be one of the caller's, in this
   * shop, and not revoked.
   */
  async assertUsable(
    tenant: TenantContext,
    user: AuthContext,
    id: string,
  ): Promise<void> {
    const device = UUID_RE.test(id)
      ? await this.database.db
          .selectFrom('app.devices')
          .select(['user_id', 'revoked_at'])
          .where('organization_id', '=', tenant.organizationId)
          .where('id', '=', id)
          .executeTakeFirst()
      : undefined;
    if (!device || device.user_id !== user.userId) throw deviceNotFound();
    if (device.revoked_at)
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'DEVICE_REVOKED',
        'Cet appareil a été retiré par un gérant : ses ventes ne sont plus acceptées.',
      );
  }

  async touch(organizationId: string, id: string): Promise<void> {
    await this.database.db
      .updateTable('app.devices')
      .set({ last_synced_at: new Date() })
      .where('organization_id', '=', organizationId)
      .where('id', '=', id)
      .execute();
  }
}
