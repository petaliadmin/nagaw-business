import { HttpStatus } from '@nestjs/common';
import type { Kysely, Transaction } from 'kysely';
import { ApiException } from '../common/api-exception.js';
import type { Database } from '../database/schema.js';

export type Executor = Kysely<Database> | Transaction<Database>;

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function notFound(code: string, message: string): ApiException {
  return new ApiException(HttpStatus.NOT_FOUND, code, message);
}

export function conflict(code: string, message: string): ApiException {
  return new ApiException(HttpStatus.CONFLICT, code, message);
}

/** Field-level validation error, in the API's usual envelope. */
export function invalid(path: string, message: string): ApiException {
  return new ApiException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_FAILED',
    'Données invalides.',
    [{ path, message }],
  );
}

export function nameTaken(what: string): ApiException {
  return conflict('NAME_TAKEN', `${what} porte déjà ce nom.`);
}

export function limitReached(what: string, max: number): ApiException {
  return conflict(
    'CATALOG_LIMIT_REACHED',
    `Limite de ${max} ${what} atteinte.`,
  );
}

/** Organization row, locked: serializes creations checked against a cap. */
export async function lockOrganization(
  trx: Transaction<Database>,
  organizationId: string,
) {
  return trx
    .selectFrom('app.organizations')
    .select([
      'default_currency',
      'max_products',
      'max_product_categories',
      'max_suppliers',
      'max_tax_rates',
    ])
    .where('id', '=', organizationId)
    .forUpdate()
    .executeTakeFirstOrThrow();
}

/** pg returns numeric and bigint as strings. */
export function toNumber(value: string | number | null): number {
  return value === null ? 0 : Number(value);
}

export function toNullableNumber(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}
