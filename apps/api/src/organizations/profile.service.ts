import { Injectable } from '@nestjs/common';
import {
  SHOP_MODULES,
  type OrganizationDto,
  type ProfileChoiceDto,
  type SaveShopProfileInput,
  type ShopModule,
  type ShopProfileDto,
  type UpdateShopModulesInput,
} from '@nagaw/shared';
import type { Kysely, Transaction } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import { invalid } from '../catalog/catalog.errors.js';
import type { AuthContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import type { Database } from '../database/schema.js';
import { toOrganizationDto } from './organizations.service.js';

/**
 * Profile of the shop and the modules it shows (ADR-062). Hiding a module is
 * a display setting: no other endpoint reads it, nothing is refused.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async get(organizationId: string): Promise<ShopProfileDto> {
    const db = this.database.db;
    const [organization, profile, choices] = await Promise.all([
      db
        .selectFrom('app.organizations')
        .select(['profile_status', 'hidden_modules', 'offer'])
        .where('id', '=', organizationId)
        .executeTakeFirstOrThrow(),
      db
        .selectFrom('app.organization_profiles')
        .selectAll()
        .where('organization_id', '=', organizationId)
        .executeTakeFirst(),
      this.choices(db),
    ]);
    return {
      status: organization.profile_status,
      sector: profile?.sector ?? null,
      channels: profile?.channels ?? [],
      goals: profile?.goals ?? [],
      teamSize: profile?.team_size ?? null,
      answeredAt: profile?.answered_at.toISOString() ?? null,
      offer: organization.offer,
      hiddenModules: organization.hidden_modules,
      choices,
    };
  }

  /** The answers, and the menu chosen on the last screen. */
  async save(
    organizationId: string,
    user: AuthContext,
    input: SaveShopProfileInput,
    requestId: string | null,
  ): Promise<ShopProfileDto> {
    await this.database.db.transaction().execute(async (trx) => {
      const choices = await this.choices(trx);
      if (
        input.sector !== null &&
        !choices.sectors.some((choice) => choice.key === input.sector)
      )
        throw invalid('sector', 'Choix inconnu');
      const unknown = input.goals.findIndex(
        (goal) => !choices.goals.some((choice) => choice.key === goal),
      );
      if (unknown !== -1) throw invalid(`goals.${unknown}`, 'Choix inconnu');

      const answers = {
        sector: input.sector,
        channels: input.channels,
        goals: input.goals,
        team_size: input.teamSize,
        answered_by: user.userId,
        answered_at: new Date(),
      };
      await trx
        .insertInto('app.organization_profiles')
        .values({ organization_id: organizationId, ...answers })
        .onConflict((oc) => oc.column('organization_id').doUpdateSet(answers))
        .execute();

      const before = await trx
        .selectFrom('app.organizations')
        .select(['offer', 'hidden_modules'])
        .where('id', '=', organizationId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const hiddenModules = ordered(input.hiddenModules);
      await trx
        .updateTable('app.organizations')
        .set({
          profile_status: 'answered',
          offer: input.offer,
          hidden_modules: hiddenModules,
        })
        .where('id', '=', organizationId)
        .execute();

      await this.audit.record(trx, {
        organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'organization.profile_answered',
        targetType: 'organization',
        targetId: organizationId,
        metadata: {
          sector: input.sector,
          channels: input.channels,
          goals: input.goals,
          teamSize: input.teamSize,
          offer: { from: before.offer, to: input.offer },
          hiddenModules: { from: before.hidden_modules, to: hiddenModules },
        },
        requestId,
      });
    });
    return this.get(organizationId);
  }

  /** « Plus tard »: the shop is not asked again; Settings keep the way. */
  async skip(
    organizationId: string,
    user: AuthContext,
    requestId: string | null,
  ): Promise<OrganizationDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const updated = await trx
        .updateTable('app.organizations')
        .set({ profile_status: 'skipped' })
        .where('id', '=', organizationId)
        .where('profile_status', '=', 'pending')
        .returningAll()
        .executeTakeFirst();
      if (!updated)
        return toOrganizationDto(
          await trx
            .selectFrom('app.organizations')
            .selectAll()
            .where('id', '=', organizationId)
            .executeTakeFirstOrThrow(),
        );
      await this.audit.record(trx, {
        organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'organization.profile_skipped',
        targetType: 'organization',
        targetId: organizationId,
        metadata: {},
        requestId,
      });
      return toOrganizationDto(updated);
    });
  }

  async updateModules(
    organizationId: string,
    user: AuthContext,
    input: UpdateShopModulesInput,
    requestId: string | null,
  ): Promise<OrganizationDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const before = await trx
        .selectFrom('app.organizations')
        .select('hidden_modules')
        .where('id', '=', organizationId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const hiddenModules = ordered(input.hiddenModules);
      const updated = await trx
        .updateTable('app.organizations')
        .set({ hidden_modules: hiddenModules })
        .where('id', '=', organizationId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit.record(trx, {
        organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'organization.modules_updated',
        targetType: 'organization',
        targetId: organizationId,
        metadata: {
          hiddenModules: { from: before.hidden_modules, to: hiddenModules },
        },
        requestId,
      });
      return toOrganizationDto(updated);
    });
  }

  private async choices(
    db: Kysely<Database> | Transaction<Database>,
  ): Promise<ShopProfileDto['choices']> {
    const rows = await db
      .selectFrom('app.profile_choices')
      .select(['kind', 'key', 'label', 'modules'])
      .where('active', '=', true)
      .orderBy('position')
      .orderBy('key')
      .execute();
    const of = (kind: 'sector' | 'goal'): ProfileChoiceDto[] =>
      rows
        .filter((row) => row.kind === kind)
        .map(({ key, label, modules }) => ({ key, label, modules }));
    return { sectors: of('sector'), goals: of('goal') };
  }
}

/** Same order as SHOP_MODULES, whatever the order sent. */
function ordered(modules: readonly ShopModule[]): ShopModule[] {
  return SHOP_MODULES.filter((module) => modules.includes(module));
}
