import { Injectable } from '@nestjs/common';
import type {
  AdminFeedbackDto,
  AnswerFeedbackInput,
  CreateFeedbackInput,
  FeedbackDto,
  FeedbackStatus,
} from '@nagaw/shared';
import type { Selectable } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import { notFound, UUID_RE, type Executor } from '../catalog/catalog.errors.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { pgErrorCode, UNIQUE_VIOLATION } from '../database/pg-errors.js';
import type { FeedbackTable } from '../database/schema.js';

const feedbackNotFound = () =>
  notFound('FEEDBACK_NOT_FOUND', 'Message introuvable.');

function toDto(row: Selectable<FeedbackTable>): FeedbackDto {
  return {
    id: row.id,
    kind: row.kind,
    message: row.message,
    page: row.page,
    status: row.status,
    answer: row.answer,
    answeredAt: row.answered_at ? row.answered_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Feedback of the pilot shops (ADR-032): a person of a shop writes to the
 * platform and sees its answer; the platform reads every shop's messages.
 */
@Injectable()
export class FeedbackService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /** What this person sent from this shop, most recent first. */
  async mine(tenant: TenantContext, user: AuthContext): Promise<FeedbackDto[]> {
    const rows = await this.database.db
      .selectFrom('app.feedback')
      .selectAll()
      .where('organization_id', '=', tenant.organizationId)
      .where('author_id', '=', user.userId)
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute();
    return rows.map(toDto);
  }

  async send(
    tenant: TenantContext,
    user: AuthContext,
    input: CreateFeedbackInput,
    requestId: string | null,
  ): Promise<{ feedback: FeedbackDto; replayed: boolean }> {
    const replay = async () => {
      const row = await this.database.db
        .selectFrom('app.feedback')
        .selectAll()
        .where('organization_id', '=', tenant.organizationId)
        .where('client_operation_id', '=', input.clientOperationId)
        .executeTakeFirst();
      return row ? toDto(row) : null;
    };
    const previous = await replay();
    if (previous) return { feedback: previous, replayed: true };
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const row = await trx
          .insertInto('app.feedback')
          .values({
            organization_id: tenant.organizationId,
            author_id: user.userId,
            kind: input.kind,
            message: input.message,
            page: input.page,
            client_operation_id: input.clientOperationId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await this.audit.record(trx, {
          organizationId: tenant.organizationId,
          actorType: 'user',
          actorId: user.userId,
          action: 'feedback.sent',
          targetType: 'feedback',
          targetId: row.id,
          metadata: { kind: input.kind, page: input.page },
          requestId,
        });
        return { feedback: toDto(row), replayed: false };
      });
    } catch (error) {
      if (pgErrorCode(error) === UNIQUE_VIOLATION) {
        const again = await replay();
        if (again) return { feedback: again, replayed: true };
      }
      throw error;
    }
  }

  async all(
    status: FeedbackStatus | undefined,
    executor: Executor = this.database.db,
    id?: string,
  ): Promise<AdminFeedbackDto[]> {
    let query = executor
      .selectFrom('app.feedback as f')
      .innerJoin('app.organizations as o', 'o.id', 'f.organization_id')
      .innerJoin('app.user_profiles as u', 'u.id', 'f.author_id')
      .selectAll('f')
      .select(['o.name as shop_name', 'u.email as author_email']);
    if (status) query = query.where('f.status', '=', status);
    if (id) query = query.where('f.id', '=', id);
    const rows = await query
      .orderBy('f.created_at', 'desc')
      .limit(200)
      .execute();
    return rows.map((row) => ({
      ...toDto(row),
      shop: { id: row.organization_id, name: row.shop_name },
      author: row.author_email,
    }));
  }

  async answer(
    admin: AuthContext,
    id: string,
    input: AnswerFeedbackInput,
    requestId: string | null,
  ): Promise<AdminFeedbackDto> {
    if (!UUID_RE.test(id)) throw feedbackNotFound();
    return this.database.db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom('app.feedback')
        .selectAll()
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!row) throw feedbackNotFound();
      // An answer, once given, stays; a later update only changes the status.
      const answer = input.answer || row.answer;
      await trx
        .updateTable('app.feedback')
        .set({
          status: input.status,
          answer,
          answered_at: answer ? (row.answered_at ?? new Date()) : null,
          answered_by: answer ? (row.answered_by ?? admin.userId) : null,
        })
        .where('id', '=', id)
        .execute();
      await this.audit.record(trx, {
        organizationId: row.organization_id,
        actorType: 'platform_admin',
        actorId: admin.userId,
        action: 'feedback.answered',
        targetType: 'feedback',
        targetId: id,
        metadata: { status: input.status, answered: answer !== '' },
        requestId,
      });
      const [dto] = await this.all(undefined, trx, id);
      return dto!;
    });
  }
}
