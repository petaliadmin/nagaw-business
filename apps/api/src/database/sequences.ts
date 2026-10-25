import type { Transaction } from 'kysely';
import type { Database, DocumentSequencesTable } from './schema.js';

/**
 * Next legal number of a shop for a kind and a year, without gap nor
 * duplicate: the sequence row stays locked until the transaction ends.
 */
export async function takeSequenceNumber(
  trx: Transaction<Database>,
  organizationId: string,
  kind: DocumentSequencesTable['kind'],
  year: number,
): Promise<number> {
  await trx
    .insertInto('app.document_sequences')
    .values({ organization_id: organizationId, kind, year })
    .onConflict((oc) => oc.doNothing())
    .execute();
  const { next_number } = await trx
    .selectFrom('app.document_sequences')
    .select('next_number')
    .where('organization_id', '=', organizationId)
    .where('kind', '=', kind)
    .where('year', '=', year)
    .forUpdate()
    .executeTakeFirstOrThrow();
  await trx
    .updateTable('app.document_sequences')
    .set({ next_number: next_number + 1 })
    .where('organization_id', '=', organizationId)
    .where('kind', '=', kind)
    .where('year', '=', year)
    .execute();
  return next_number;
}
