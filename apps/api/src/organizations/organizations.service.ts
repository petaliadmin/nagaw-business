import { createHash } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  PRODUCT_PHOTO_MAX_BYTES,
  type CreateOrganizationInput,
  type MemberDto,
  type OrganizationDto,
  type OrganizationWithRoleDto,
  type Role,
  type ShopLogoType,
  type ShopMarkKind,
  type UpdateOrganizationInput,
} from '@nagaw/shared';
import type { Selectable, Transaction } from 'kysely';
import { PDFDocument } from 'pdf-lib';
import { AuditService } from '../audit/audit.service.js';
import { invalid } from '../catalog/catalog.errors.js';
import { detectImageType } from '../catalog/products.service.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import {
  FOREIGN_KEY_VIOLATION,
  pgErrorCode,
  UNIQUE_VIOLATION,
} from '../database/pg-errors.js';
import type { Database, OrganizationsTable } from '../database/schema.js';
import { embedLogo } from '../documents/pdf.js';
import { generateSlug } from './slug.js';

const MAX_SLUG_ATTEMPTS = 3;

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /** Creates an organization; the creator becomes its owner. */
  async create(
    user: AuthContext,
    input: CreateOrganizationInput,
    requestId: string | null,
  ): Promise<OrganizationWithRoleDto> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.database.db.transaction().execute(async (trx) => {
          const organization = await trx
            .insertInto('app.organizations')
            .values({
              name: input.name,
              slug: generateSlug(input.name),
              timezone: input.timezone,
              default_currency: input.defaultCurrency,
              phone: input.phone,
              offer: input.offer,
              created_by: user.userId,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

          if (input.ownerName)
            await trx
              .updateTable('app.user_profiles')
              .set({ display_name: input.ownerName })
              .where('id', '=', user.userId)
              .execute();

          await trx
            .insertInto('app.organization_memberships')
            .values({
              organization_id: organization.id,
              user_id: user.userId,
              role: 'owner',
            })
            .execute();

          await this.audit.record(trx, {
            organizationId: organization.id,
            actorType: 'user',
            actorId: user.userId,
            action: 'organization.created',
            targetType: 'organization',
            targetId: organization.id,
            metadata: { name: organization.name },
            requestId,
          });

          return {
            ...toOrganizationDto(organization),
            role: 'owner' as Role,
            maxDiscountBasisPoints: null,
            platformAccess: false,
          };
        });
      } catch (error) {
        const code = pgErrorCode(error);
        if (code === UNIQUE_VIOLATION && attempt < MAX_SLUG_ATTEMPTS) continue;
        if (code === FOREIGN_KEY_VIOLATION) {
          // The auth trigger did not create a profile for this user.
          throw new ApiException(
            HttpStatus.CONFLICT,
            'PROFILE_MISSING',
            'Profil utilisateur introuvable.',
          );
        }
        throw error;
      }
    }
  }

  async get(organizationId: string): Promise<OrganizationDto> {
    const organization = await this.database.db
      .selectFrom('app.organizations')
      .selectAll()
      .where('id', '=', organizationId)
      .executeTakeFirstOrThrow();
    return toOrganizationDto(organization);
  }

  async update(
    organizationId: string,
    user: AuthContext,
    input: UpdateOrganizationInput,
    requestId: string | null,
  ): Promise<OrganizationDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const before = await trx
        .selectFrom('app.organizations')
        .selectAll()
        .where('id', '=', organizationId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      const set: Record<string, string | number> = {};
      for (const [field, column] of Object.entries(UPDATABLE)) {
        const value = input[field as keyof UpdateOrganizationInput];
        if (value !== undefined) set[column] = value;
      }
      const updated = await trx
        .updateTable('app.organizations')
        .set(set)
        .where('id', '=', organizationId)
        .returningAll()
        .executeTakeFirstOrThrow();

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [field, column] of Object.entries(UPDATABLE)) {
        const from = before[column];
        const to = updated[column];
        if (from !== to) changes[field] = { from, to };
      }

      await this.audit.record(trx, {
        organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'organization.updated',
        targetType: 'organization',
        targetId: organizationId,
        metadata: { changes },
        requestId,
      });

      return toOrganizationDto(updated);
    });
  }

  /**
   * A PNG or JPEG that can be drawn on every PDF of the shop: it is tried in
   * one before being accepted.
   */
  private async checkedImage(
    field: string,
    name: string,
    declaredType: string | undefined,
    data: unknown,
  ): Promise<{ image: Buffer; contentType: ShopLogoType }> {
    const refused = invalid(field, 'Envoyez une image PNG ou JPEG.');
    if (!Buffer.isBuffer(data) || data.length === 0) throw refused;
    if (data.length > PRODUCT_PHOTO_MAX_BYTES)
      throw new ApiException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'PHOTO_TOO_LARGE',
        `${name} trop lourd : 512 Ko au plus.`,
      );
    const contentType = detectImageType(data);
    if (
      (contentType !== 'image/png' && contentType !== 'image/jpeg') ||
      contentType !== declaredType?.split(';')[0]?.trim()
    )
      throw refused;
    try {
      await embedLogo(await PDFDocument.create(), { contentType, data });
    } catch (error) {
      this.logger.warn(`${name} refusé, image illisible : ${String(error)}`);
      throw refused;
    }
    return { image: data, contentType };
  }

  /** The shop's signature or stamp (ADR-052). */
  async mark(
    organizationId: string,
    kind: ShopMarkKind,
  ): Promise<{ contentType: ShopLogoType; data: Buffer; sha256: string }> {
    const row = await this.database.db
      .selectFrom('app.organizations as o')
      .innerJoin('app.organization_marks as m', (join) =>
        join
          .onRef('m.organization_id', '=', 'o.id')
          .onRef(
            'm.sha256',
            '=',
            kind === 'signature' ? 'o.signature_sha256' : 'o.stamp_sha256',
          ),
      )
      .select(['m.content_type', 'm.data', 'm.sha256'])
      .where('o.id', '=', organizationId)
      .where('m.kind', '=', kind)
      .executeTakeFirst();
    if (!row)
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'MARK_NOT_FOUND',
        'Cette image n’existe pas.',
      );
    return {
      contentType: row.content_type,
      data: row.data,
      sha256: row.sha256,
    };
  }

  async setMark(
    organizationId: string,
    user: AuthContext,
    kind: ShopMarkKind,
    declaredType: string | undefined,
    data: unknown,
    requestId: string | null,
  ): Promise<OrganizationDto> {
    const { image, contentType } = await this.checkedImage(
      kind,
      'Image',
      declaredType,
      data,
    );
    const sha256 = createHash('sha256').update(image).digest('hex');
    return this.database.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('app.organization_marks')
        .values({
          organization_id: organizationId,
          kind,
          content_type: contentType,
          data: image,
          sha256,
          updated_by: user.userId,
        })
        .onConflict((oc) =>
          oc.columns(['organization_id', 'kind']).doUpdateSet({
            content_type: contentType,
            data: image,
            sha256,
            updated_by: user.userId,
            updated_at: new Date(),
          }),
        )
        .execute();
      return this.pointMark(trx, organizationId, user, kind, sha256, requestId);
    });
  }

  async removeMark(
    organizationId: string,
    user: AuthContext,
    kind: ShopMarkKind,
    requestId: string | null,
  ): Promise<OrganizationDto> {
    return this.database.db
      .transaction()
      .execute((trx) =>
        this.pointMark(trx, organizationId, user, kind, null, requestId),
      );
  }

  private async pointMark(
    trx: Transaction<Database>,
    organizationId: string,
    user: AuthContext,
    kind: ShopMarkKind,
    sha256: string | null,
    requestId: string | null,
  ): Promise<OrganizationDto> {
    const updated = await trx
      .updateTable('app.organizations')
      .set(
        kind === 'signature'
          ? { signature_sha256: sha256 }
          : { stamp_sha256: sha256 },
      )
      .where('id', '=', organizationId)
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.audit.record(trx, {
      organizationId,
      actorType: 'user',
      actorId: user.userId,
      action: sha256
        ? `organization.${kind}_changed`
        : `organization.${kind}_removed`,
      targetType: 'organization',
      targetId: organizationId,
      requestId,
    });
    return toOrganizationDto(updated);
  }

  /** The shop's current logo (ADR-044). */
  async logo(
    organizationId: string,
  ): Promise<{ contentType: ShopLogoType; data: Buffer; sha256: string }> {
    const row = await this.database.db
      .selectFrom('app.organizations as o')
      .innerJoin('app.organization_logos as l', (join) =>
        join
          .onRef('l.organization_id', '=', 'o.id')
          .onRef('l.sha256', '=', 'o.logo_sha256'),
      )
      .select(['l.content_type', 'l.data', 'l.sha256'])
      .where('o.id', '=', organizationId)
      .executeTakeFirst();
    if (!row)
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'LOGO_NOT_FOUND',
        'Cette boutique n’a pas de logo.',
      );
    return {
      contentType: row.content_type,
      data: row.data,
      sha256: row.sha256,
    };
  }

  async setLogo(
    organizationId: string,
    user: AuthContext,
    declaredType: string | undefined,
    data: unknown,
    requestId: string | null,
  ): Promise<OrganizationDto> {
    const { image, contentType } = await this.checkedImage(
      'logo',
      'Logo',
      declaredType,
      data,
    );
    const sha256 = createHash('sha256').update(image).digest('hex');

    return this.database.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('app.organization_logos')
        .values({
          organization_id: organizationId,
          content_type: contentType,
          data: image,
          sha256,
          updated_by: user.userId,
        })
        .onConflict((oc) =>
          oc.column('organization_id').doUpdateSet({
            content_type: contentType,
            data: image,
            sha256,
            updated_by: user.userId,
            updated_at: new Date(),
          }),
        )
        .execute();
      const updated = await trx
        .updateTable('app.organizations')
        .set({ logo_sha256: sha256 })
        .where('id', '=', organizationId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit.record(trx, {
        organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'organization.logo_changed',
        targetType: 'organization',
        targetId: organizationId,
        requestId,
      });
      return toOrganizationDto(updated);
    });
  }

  async removeLogo(
    organizationId: string,
    user: AuthContext,
    requestId: string | null,
  ): Promise<OrganizationDto> {
    return this.database.db.transaction().execute(async (trx) => {
      const updated = await trx
        .updateTable('app.organizations')
        .set({ logo_sha256: null })
        .where('id', '=', organizationId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit.record(trx, {
        organizationId,
        actorType: 'user',
        actorId: user.userId,
        action: 'organization.logo_removed',
        targetType: 'organization',
        targetId: organizationId,
        requestId,
      });
      return toOrganizationDto(updated);
    });
  }

  async listMembers(organizationId: string): Promise<MemberDto[]> {
    const rows = await this.database.db
      .selectFrom('app.organization_memberships as m')
      .innerJoin('app.user_profiles as p', 'p.id', 'm.user_id')
      .select([
        'm.user_id',
        'p.email',
        'p.display_name',
        'm.role',
        'm.status',
        'm.max_discount_basis_points',
        'm.created_at',
      ])
      .where('m.organization_id', '=', organizationId)
      .orderBy('m.created_at', 'asc')
      .execute();
    return rows.map((row) => ({
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      status: row.status,
      maxDiscountBasisPoints: row.max_discount_basis_points,
      joinedAt: row.created_at.toISOString(),
    }));
  }

  /**
   * Active organizations the user belongs to, with their role; after them,
   * those the platform administrator entered through an open access
   * (ADR-040), as an owner, the guard granting the same.
   */
  async listForUser(userId: string): Promise<OrganizationWithRoleDto[]> {
    const db = this.database.db;
    const [memberships, accesses] = await Promise.all([
      db
        .selectFrom('app.organization_memberships as m')
        .innerJoin('app.organizations as o', 'o.id', 'm.organization_id')
        .selectAll('o')
        .select(['m.role', 'm.max_discount_basis_points'])
        .where('m.user_id', '=', userId)
        .where('m.status', '=', 'active')
        .where('o.status', '=', 'active')
        .orderBy('o.name', 'asc')
        .execute(),
      db
        .selectFrom('app.platform_shop_accesses as a')
        .innerJoin('app.platform_admins as p', 'p.user_id', 'a.admin_id')
        .innerJoin('app.organizations as o', 'o.id', 'a.organization_id')
        .selectAll('o')
        .where('a.admin_id', '=', userId)
        .where('a.closed_at', 'is', null)
        .where('o.status', '=', 'active')
        .orderBy('o.name', 'asc')
        .execute(),
    ]);
    const member = new Set(memberships.map((row) => row.id));
    return [
      ...memberships.map((row) => ({
        ...toOrganizationDto(row),
        role: row.role,
        maxDiscountBasisPoints: row.max_discount_basis_points,
        platformAccess: false,
      })),
      ...accesses
        .filter((row) => !member.has(row.id))
        .map((row) => ({
          ...toOrganizationDto(row),
          role: 'owner' as Role,
          maxDiscountBasisPoints: null,
          platformAccess: true,
        })),
    ];
  }
}

/** API field → column, for the settings an owner may change. */
const UPDATABLE = {
  name: 'name',
  timezone: 'timezone',
  defaultCurrency: 'default_currency',
  invitationTtlHours: 'invitation_ttl_hours',
  legalName: 'legal_name',
  address: 'address',
  phone: 'phone',
  email: 'email',
  taxId: 'tax_id',
  tradeRegister: 'trade_register',
  invoiceFooter: 'invoice_footer',
  documentColor: 'document_color',
  offer: 'offer',
  invoiceDueDays: 'invoice_due_days',
  quoteValidityDays: 'quote_validity_days',
} as const satisfies Partial<
  Record<keyof UpdateOrganizationInput, keyof OrganizationsTable>
>;

function toOrganizationDto(
  row: Selectable<OrganizationsTable>,
): OrganizationDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    timezone: row.timezone,
    defaultCurrency: row.default_currency,
    invitationTtlHours: row.invitation_ttl_hours,
    legalName: row.legal_name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    taxId: row.tax_id,
    tradeRegister: row.trade_register,
    invoiceFooter: row.invoice_footer,
    invoiceDueDays: row.invoice_due_days,
    quoteValidityDays: row.quote_validity_days,
    documentColor: row.document_color,
    offer: row.offer,
    logoVersion: row.logo_sha256?.slice(0, 16) ?? null,
    signatureVersion: row.signature_sha256?.slice(0, 16) ?? null,
    stampVersion: row.stamp_sha256?.slice(0, 16) ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
