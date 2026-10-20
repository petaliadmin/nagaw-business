import { Injectable } from '@nestjs/common';
import type { AuditLogDto, Paginated } from '@nagaw/shared';
import type { Kysely, Transaction } from 'kysely';
import { DatabaseService } from '../database/database.service.js';
import type { Database } from '../database/schema.js';

export interface AuditEntry {
  organizationId: string | null;
  actorType: 'user' | 'agent' | 'system' | 'platform_admin';
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  requestId: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Appends an entry. Pass the transaction of the audited change so that the
   * change and its audit record commit or roll back together.
   */
  async record(
    executor: Kysely<Database> | Transaction<Database>,
    entry: AuditEntry,
  ): Promise<void> {
    await executor
      .insertInto('app.audit_logs')
      .values({
        organization_id: entry.organizationId,
        actor_type: entry.actorType,
        actor_id: entry.actorId,
        action: entry.action,
        target_type: entry.targetType ?? null,
        target_id: entry.targetId ?? null,
        metadata: JSON.stringify(entry.metadata ?? {}),
        request_id: entry.requestId,
      })
      .execute();
  }

  async list(
    organizationId: string,
    limit: number,
    cursor?: string,
  ): Promise<Paginated<AuditLogDto>> {
    let query = this.database.db
      .selectFrom('app.audit_logs')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .orderBy('id', 'desc')
      .limit(limit + 1);
    if (cursor) query = query.where('id', '<', cursor);

    const rows = await query.execute();
    const page = rows.slice(0, limit);
    return {
      data: page.map((row) => ({
        id: row.id,
        actorType: row.actor_type,
        actorId: row.actor_id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        metadata: row.metadata,
        requestId: row.request_id,
        createdAt: row.created_at.toISOString(),
      })),
      nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
    };
  }
}
