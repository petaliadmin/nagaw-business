import {
  formatDeviceTicket,
  type CustomerDto,
  type PaymentInput,
  type ProductDto,
  type SyncOperation,
  type SyncResponseDto,
  type ShopOffer,
  type SyncCheckResponseDto,
} from '@nagaw/shared';
import { idb, STORES, transact } from './db';
import { classifyAnswer, nextAttemptAt, randomTicketPrefix } from './delivery';
import { applyPendingStock } from './local-stock';

/** Shop data the checkout needs to work offline. */
export interface ShopSnapshot {
  organizationId: string;
  shop: {
    name: string;
    currency: string;
    timeZone: string;
    role: string;
    /** Absent in older copies. */
    offer?: ShopOffer;
    logoVersion?: string | null;
    /** Absent in older copies: the default country applies. */
    phoneCountryCode?: string;
  };
  products: ProductDto[];
  /** `pendingOperationId`: created on this device, not yet sent. */
  customers: (CustomerDto & { pendingOperationId?: string })[];
  device: { id: string; ticketPrefix: string } | null;
  /** Prefix of the tickets sold before the server gave this device one. */
  localPrefix?: string;
  /** The person using the phone, seller of what is sold (ADR-053). */
  user?: { id: string; email: string };
  /** Shop rules the checkout applies offline (absent in older copies). */
  rules?: {
    stockCorrectionMax: number;
    /** ADR-038; absent in older copies: the strictest choice applies. */
    sellerCanSellBelowCost?: boolean;
    maxDiscountBasisPoints?: number | null;
  };
  /** Next offline ticket number of this device. */
  nextTicket: number;
  refreshedAt: string;
}

export interface OutboxEntry {
  seq?: number;
  organizationId: string;
  /** Null: recorded before the server knew this device (ADR-053). */
  deviceId: string | null;
  operation: SyncOperation;
  createdAt: string;
  /** Times the server could not treat it. */
  attempts?: number;
  /** Not sent again before this time (ms). */
  nextAttemptAt?: number;
}

/**
 * Why the server refuses every operation of a device: the person signed
 * in is not of its shop (`DEVICE_NOT_FOUND`) or a manager removed it
 * (`DEVICE_REVOKED`). Its operations stay on the phone, never lost.
 */
export interface BlockedDevice {
  deviceId: string;
  organizationId: string;
  code: string;
  message: string;
}

export type TicketStatus = 'pending' | 'sent' | 'rejected';

/** A sale recorded on this device, as printed (see LocalTicket). */
export interface LocalTicket {
  clientOperationId: string;
  organizationId: string;
  deviceTicket: string;
  status: TicketStatus;
  saleId?: string;
  saleNumber?: number;
  reason?: string;
  /** The sale as sent: the phone can always send it again (ADR-053). */
  operation?: SyncOperation;
  /** What the ticket shows: lines, totals, payments, customer. */
  sale: {
    occurredAt: string;
    customerName: string | null;
    customerPhone: string | null;
    lines: {
      label: string;
      unit: ProductDto['unit'];
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      /** ADR-038 (absent in older tickets: the stock unit, no deal). */
      productUnitId?: string | null;
      unitLabel?: string | null;
      unitFactor?: number;
      priceBasis?: 'unit' | 'stock';
      listTotal?: number;
    }[];
    subtotal: number;
    discount: number;
    total: number;
    taxTotal: number;
    payments: PaymentInput[];
    cashReceived: number | null;
  };
}

export interface RejectedEntry {
  clientOperationId: string;
  organizationId: string;
  type: SyncOperation['type'];
  label: string;
  code: string;
  message: string;
  at: string;
  /** The operation itself, to send it again (absent in older entries). */
  operation?: SyncOperation;
  deviceId?: string | null;
}

const ACTIVE_KEY = '__active';
const BLOCKED_KEY = '__blocked';
const LOCKED_KEY = '__locked';
export const OUTBOX_EVENT = 'nagaw:outbox';

function notify() {
  window.dispatchEvent(new Event(OUTBOX_EVENT));
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export async function readSnapshot(
  organizationId?: string,
): Promise<ShopSnapshot | null> {
  return transact([STORES.snapshots], 'readonly', async (tx) => {
    const id =
      organizationId ??
      (await idb.get<{ value: string }>(tx, STORES.snapshots, ACTIVE_KEY))
        ?.value;
    if (!id) return null;
    return (await idb.get<ShopSnapshot>(tx, STORES.snapshots, id)) ?? null;
  });
}

/** Signing out closes the checkout, and erases nothing (ADR-053). */
export async function lockCheckout(): Promise<void> {
  await transact([STORES.snapshots], 'readwrite', (tx) =>
    idb.put(tx, STORES.snapshots, { organizationId: LOCKED_KEY, value: true }),
  );
}

export async function isCheckoutLocked(): Promise<boolean> {
  return transact(
    [STORES.snapshots],
    'readonly',
    async (tx) =>
      (await idb.get<{ value: boolean }>(tx, STORES.snapshots, LOCKED_KEY))
        ?.value === true,
  );
}

/** Asks the browser not to clear this phone's sales when space runs low. */
export async function keepLocalData(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch (error) {
    console.warn('Stockage durable refusé par le navigateur', error);
  }
}

/**
 * Stores fresh server data, keeping what only this device knows: its
 * ticket counter and the customers created offline and not yet sent.
 */
export async function saveSnapshot(
  fresh: Omit<ShopSnapshot, 'nextTicket' | 'refreshedAt'>,
): Promise<ShopSnapshot> {
  return transact(
    [STORES.snapshots, STORES.outbox],
    'readwrite',
    async (tx) => {
      const previous = await idb.get<ShopSnapshot>(
        tx,
        STORES.snapshots,
        fresh.organizationId,
      );
      const pending = (previous?.customers ?? []).filter(
        (c) => c.pendingOperationId,
      );
      const sameDevice = previous?.device?.id === fresh.device?.id;
      // What this phone did and has not sent yet is not in the server's stock.
      const waiting = (await idb.getAll<OutboxEntry>(tx, STORES.outbox))
        .filter((e) => e.organizationId === fresh.organizationId)
        .map((e) => e.operation);
      const snapshot: ShopSnapshot = {
        ...fresh,
        products: applyPendingStock(fresh.products, waiting),
        // Customers created here and not sent yet are unknown to the server.
        customers: [...fresh.customers, ...pending],
        localPrefix: previous?.localPrefix ?? randomTicketPrefix(),
        nextTicket: sameDevice ? (previous?.nextTicket ?? 1) : 1,
        refreshedAt: new Date().toISOString(),
      };
      await idb.put(tx, STORES.snapshots, snapshot);
      await idb.put(tx, STORES.snapshots, {
        organizationId: ACTIVE_KEY,
        value: fresh.organizationId,
      });
      await idb.delete(tx, STORES.snapshots, LOCKED_KEY);
      return snapshot;
    },
  );
}

// ---------------------------------------------------------------------------
// Recording offline
// ---------------------------------------------------------------------------

/**
 * Records a sale on the device, in one local transaction: takes the next
 * ticket number, queues the operations (a new customer first) and keeps
 * the ticket with its sale. It needs nothing from the server: a phone the
 * server has not registered yet sells with its own prefix (ADR-053).
 */
export async function recordLocally(
  organizationId: string,
  build: (deviceTicket: string) => {
    operations: SyncOperation[];
    ticket: Omit<LocalTicket, 'deviceTicket' | 'organizationId' | 'status'>;
  },
): Promise<LocalTicket> {
  const ticket = await transact(
    [STORES.snapshots, STORES.outbox, STORES.tickets],
    'readwrite',
    async (tx) => {
      const snapshot = await idb.get<ShopSnapshot>(
        tx,
        STORES.snapshots,
        organizationId,
      );
      if (!snapshot) throw new Error('Boutique absente de ce téléphone');
      const localPrefix = snapshot.localPrefix ?? randomTicketPrefix();
      const deviceTicket = formatDeviceTicket(
        snapshot.device?.ticketPrefix ?? localPrefix,
        snapshot.nextTicket,
      );
      const { operations, ticket: draft } = build(deviceTicket);
      await idb.put(tx, STORES.snapshots, {
        ...snapshot,
        localPrefix,
        products: applyPendingStock(snapshot.products, operations),
        nextTicket: snapshot.nextTicket + 1,
      });
      for (const operation of operations) {
        const entry: OutboxEntry = {
          organizationId,
          deviceId: snapshot.device?.id ?? null,
          operation,
          createdAt: new Date().toISOString(),
        };
        await idb.add(tx, STORES.outbox, entry);
      }
      const local: LocalTicket = {
        ...draft,
        deviceTicket,
        organizationId,
        status: 'pending',
        operation: operations.find(
          (o) => o.clientOperationId === draft.clientOperationId,
        ),
      };
      await idb.put(tx, STORES.tickets, local);
      return local;
    },
  );
  notify();
  return ticket;
}

/**
 * A stock correction made at the counter (ADR-036): queued like a sale,
 * before the sale that follows it, and applied to this phone's stock at
 * once. Resolves with the updated snapshot.
 */
export async function correctStockLocally(
  organizationId: string,
  operation: Extract<SyncOperation, { type: 'stock_correction' }>,
): Promise<ShopSnapshot> {
  const updated = await transact(
    [STORES.snapshots, STORES.outbox],
    'readwrite',
    async (tx) => {
      const snapshot = await idb.get<ShopSnapshot>(
        tx,
        STORES.snapshots,
        organizationId,
      );
      if (!snapshot) throw new Error('Boutique absente de ce téléphone');
      const next: ShopSnapshot = {
        ...snapshot,
        products: applyPendingStock(snapshot.products, [operation]),
      };
      await idb.put(tx, STORES.snapshots, next);
      const entry: OutboxEntry = {
        organizationId,
        deviceId: snapshot.device?.id ?? null,
        operation,
        createdAt: new Date().toISOString(),
      };
      await idb.add(tx, STORES.outbox, entry);
      return next;
    },
  );
  notify();
  return updated;
}

/** A customer created at the counter, sent with the next batch. */
export async function addLocalCustomer(
  organizationId: string,
  customer: CustomerDto & { pendingOperationId: string },
): Promise<void> {
  await transact([STORES.snapshots, STORES.outbox], 'readwrite', async (tx) => {
    const snapshot = await idb.get<ShopSnapshot>(
      tx,
      STORES.snapshots,
      organizationId,
    );
    if (!snapshot) throw new Error('Boutique absente de ce téléphone');
    await idb.put(tx, STORES.snapshots, {
      ...snapshot,
      customers: [...snapshot.customers, customer],
    });
    const entry: OutboxEntry = {
      organizationId,
      deviceId: snapshot.device?.id ?? null,
      operation: {
        type: 'customer',
        clientOperationId: customer.pendingOperationId,
        data: {
          name: customer.name,
          phone: customer.phone,
          email: '',
          address: '',
          taxId: '',
          notes: '',
          creditLimit: null,
        },
      },
      createdAt: new Date().toISOString(),
    };
    await idb.add(tx, STORES.outbox, entry);
  });
  notify();
}

export async function readTicket(
  clientOperationId: string,
): Promise<LocalTicket | null> {
  return transact(
    [STORES.tickets],
    'readonly',
    async (tx) =>
      (await idb.get<LocalTicket>(tx, STORES.tickets, clientOperationId)) ??
      null,
  );
}

/** The latest sales kept on this phone, whatever became of them. */
export async function listTickets(
  organizationId: string,
  limit = 50,
): Promise<LocalTicket[]> {
  const tickets = await transact([STORES.tickets], 'readonly', (tx) =>
    idb.getAll<LocalTicket>(tx, STORES.tickets),
  );
  return tickets
    .filter((t) => t.organizationId === organizationId)
    .sort((a, b) => b.sale.occurredAt.localeCompare(a.sale.occurredAt))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Status and synchronization
// ---------------------------------------------------------------------------

export interface OutboxStatus {
  /** Sales that will leave with the next sending. */
  pendingSales: number;
  pendingOther: number;
  rejected: RejectedEntry[];
  /** Sales kept on a device the server refuses, with the reason. */
  blocked: (BlockedDevice & { sales: number })[];
  /** Why the last sending stopped, if it did. */
  problem: 'session' | 'server' | null;
}

let lastProblem: OutboxStatus['problem'] = null;

async function readBlocked(tx: IDBTransaction): Promise<BlockedDevice[]> {
  return (
    (
      await idb.get<{ value: BlockedDevice[] }>(
        tx,
        STORES.snapshots,
        BLOCKED_KEY,
      )
    )?.value ?? []
  );
}

export async function outboxStatus(): Promise<OutboxStatus> {
  return transact(
    [STORES.outbox, STORES.rejected, STORES.snapshots],
    'readonly',
    async (tx) => {
      const pending = await idb.getAll<OutboxEntry>(tx, STORES.outbox);
      const rejected = await idb.getAll<RejectedEntry>(tx, STORES.rejected);
      const blockedDevices = (await readBlocked(tx)).filter((b) =>
        pending.some((e) => e.deviceId === b.deviceId),
      );
      const isBlocked = (e: OutboxEntry) =>
        blockedDevices.some((b) => b.deviceId === e.deviceId);
      const free = pending.filter((e) => !isBlocked(e));
      return {
        pendingSales: free.filter((e) => e.operation.type === 'sale').length,
        pendingOther: free.filter((e) => e.operation.type !== 'sale').length,
        rejected,
        blocked: blockedDevices.map((b) => ({
          ...b,
          sales: pending.filter(
            (e) => e.deviceId === b.deviceId && e.operation.type === 'sale',
          ).length,
        })),
        problem: lastProblem,
      };
    },
  );
}

async function setBlocked(
  update: (current: BlockedDevice[]) => BlockedDevice[],
): Promise<void> {
  await transact([STORES.snapshots], 'readwrite', async (tx) => {
    const next = update(await readBlocked(tx));
    await idb.put(tx, STORES.snapshots, {
      organizationId: BLOCKED_KEY,
      value: next,
    });
  });
}

export async function dismissRejected(
  clientOperationId: string,
): Promise<void> {
  await transact([STORES.rejected], 'readwrite', (tx) =>
    idb.delete(tx, STORES.rejected, clientOperationId),
  );
  notify();
}

/**
 * Puts a refused operation back in the queue, as it was: the person signed
 * in now may have the right, or the catalogue may have been corrected.
 */
export async function retryRejected(clientOperationId: string): Promise<void> {
  await transact(
    [STORES.rejected, STORES.outbox, STORES.tickets],
    'readwrite',
    async (tx) => {
      const entry = await idb.get<RejectedEntry>(
        tx,
        STORES.rejected,
        clientOperationId,
      );
      if (!entry?.operation) return;
      await requeue(tx, entry.organizationId, entry.deviceId ?? null, {
        operation: entry.operation,
      });
      await idb.delete(tx, STORES.rejected, clientOperationId);
    },
  );
  notify();
}

async function requeue(
  tx: IDBTransaction,
  organizationId: string,
  deviceId: string | null,
  { operation }: { operation: SyncOperation },
): Promise<void> {
  const queued: OutboxEntry = {
    organizationId,
    deviceId,
    operation,
    createdAt: new Date().toISOString(),
  };
  await idb.add(tx, STORES.outbox, queued);
  const ticket = await idb.get<LocalTicket>(
    tx,
    STORES.tickets,
    operation.clientOperationId,
  );
  if (ticket)
    await idb.put(tx, STORES.tickets, {
      ...ticket,
      status: 'pending',
      reason: undefined,
    });
}

export type FlushOutcome =
  'empty' | 'sent' | 'offline' | 'signed-out' | 'device-refused' | 'server';

/** A slow network must not hold the queue forever. */
const SEND_TIMEOUT_MS = 30_000;

let flushing: Promise<FlushOutcome> | null = null;

/**
 * Sends the queued operations, oldest first, 50 at a time, and applies the
 * answers. Only one flush runs at a time; operations stay queued on any
 * network or session problem (nothing is ever lost).
 */
export function flushOutbox(): Promise<FlushOutcome> {
  flushing ??= runFlush(false).finally(() => {
    flushing = null;
  });
  return flushing;
}

/**
 * The person asked: what waits leaves now, even what the server could not
 * treat and that would only come back later (ADR-053).
 */
export async function flushOutboxNow(): Promise<FlushOutcome> {
  await flushing;
  flushing = runFlush(true).finally(() => {
    flushing = null;
  });
  return flushing;
}

/** What can leave now, in order, each with the device that sends it. */
async function readyToSend(
  skipped: Set<string>,
  now: boolean,
): Promise<(OutboxEntry & { deviceId: string })[]> {
  return transact([STORES.outbox, STORES.snapshots], 'readonly', async (tx) => {
    const entries = await idb.getAll<OutboxEntry>(tx, STORES.outbox);
    const time = now ? 0 : Date.now();
    const waiting = new Set<string>();
    const ready: (OutboxEntry & { deviceId: string })[] = [];
    for (const entry of entries) {
      const { operation } = entry;
      const snapshot = await idb.get<ShopSnapshot>(
        tx,
        STORES.snapshots,
        entry.organizationId,
      );
      const deviceId = entry.deviceId ?? snapshot?.device?.id ?? null;
      // A sale never leaves before the customer it waits for.
      const behind =
        operation.type === 'sale' &&
        operation.data.customerOperationId !== null &&
        waiting.has(operation.data.customerOperationId);
      if (
        behind ||
        deviceId === null ||
        skipped.has(`${entry.organizationId}:${deviceId}`) ||
        (time > 0 && (entry.nextAttemptAt ?? 0) > time)
      ) {
        waiting.add(operation.clientOperationId);
        continue;
      }
      ready.push({ ...entry, deviceId });
    }
    return ready;
  });
}

/** The server could not treat it: it comes back later, the others go on. */
async function postpone(entry: OutboxEntry): Promise<void> {
  await transact([STORES.outbox], 'readwrite', (tx) => putBack(tx, entry));
}

async function putBack(tx: IDBTransaction, entry: OutboxEntry): Promise<void> {
  const attempts = (entry.attempts ?? 0) + 1;
  await idb.put(tx, STORES.outbox, {
    ...entry,
    attempts,
    nextAttemptAt: nextAttemptAt(attempts, Date.now()),
  });
}

async function runFlush(now: boolean): Promise<FlushOutcome> {
  let sentAny = false;
  let refusedAny = false;
  // Asked by a person, each operation is tried once in this round.
  const tried = new Set<number>();
  // Once a whole batch was not taken, the rest of the round leaves one by
  // one: the operation that causes it is found and set aside (ADR-053).
  let batchSize = 50;
  // A device the server refuses is set aside for this round: the other
  // devices' operations (another shop on the same phone) still leave.
  const skipped = new Set<string>();
  const finish = (outcome: FlushOutcome): FlushOutcome => {
    if (outcome !== 'offline')
      lastProblem =
        outcome === 'signed-out'
          ? 'session'
          : outcome === 'server'
            ? 'server'
            : null;
    // The banner learns why the sending stopped.
    notify();
    return outcome;
  };
  for (;;) {
    const ready = (await readyToSend(skipped, now)).filter(
      (e) => !tried.has(e.seq!),
    );
    if (ready.length === 0)
      return finish(sentAny ? 'sent' : refusedAny ? 'device-refused' : 'empty');
    // One device and one shop per request.
    const { deviceId, organizationId } = ready[0]!;
    const group = ready
      .filter(
        (e) => e.deviceId === deviceId && e.organizationId === organizationId,
      )
      .slice(0, batchSize);
    for (const entry of group) tried.add(entry.seq!);

    let response: Response;
    try {
      response = await fetch('/caisse/synchroniser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'manual',
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        body: JSON.stringify({
          organizationId,
          deviceId,
          operations: group.map((e) => e.operation),
        }),
      });
    } catch (error) {
      console.info('Synchronisation reportée : pas de réseau', error);
      return finish(sentAny ? 'sent' : 'offline');
    }
    const answer = classifyAnswer(response.status);
    if (answer === 'session') return finish('signed-out');
    if (answer === 'device') {
      const body = (await response.json().catch(() => null)) as {
        code?: string;
        error?: string;
      } | null;
      const code =
        body?.code ??
        (response.status === 403 ? 'DEVICE_REVOKED' : 'DEVICE_NOT_FOUND');
      await setBlocked((current) => [
        ...current.filter((b) => b.deviceId !== deviceId),
        {
          deviceId,
          organizationId,
          code,
          message: body?.error ?? 'Appareil refusé par le serveur.',
        },
      ]);
      skipped.add(`${organizationId}:${deviceId}`);
      refusedAny = true;
      notify();
      continue;
    }
    if (answer !== 'results') {
      if (group.length > 1) {
        for (const entry of group) tried.delete(entry.seq!);
        batchSize = 1;
        continue;
      }
      const only = group[0]!;
      if (answer === 'invalid') {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        await refuse(only, {
          code: `HTTP_${response.status}`,
          message:
            body?.error && body.error !== 'invalid'
              ? body.error
              : 'Le serveur ne peut pas lire cette opération.',
        });
        continue;
      }
      // The server is unwell: this one waits longer, and the round stops.
      console.warn('Synchronisation reportée', response.status);
      await postpone(only);
      return finish(sentAny ? 'sent' : 'server');
    }
    const { results } = (await response.json()) as SyncResponseDto;
    await applyResults(group, results);
    await setBlocked((current) =>
      current.filter((b) => b.deviceId !== deviceId),
    );
    sentAny = true;
    notify();
  }
}

/** Set aside with its reason and its content: never deleted (ADR-053). */
async function refuse(
  entry: OutboxEntry,
  reason: { code: string; message: string },
): Promise<void> {
  await transact(
    [STORES.outbox, STORES.rejected, STORES.tickets],
    'readwrite',
    async (tx) => {
      await idb.delete(tx, STORES.outbox, entry.seq!);
      await keepRefused(tx, entry, reason);
    },
  );
  notify();
}

async function keepRefused(
  tx: IDBTransaction,
  entry: OutboxEntry,
  reason: { code: string; message: string },
): Promise<void> {
  const { operation } = entry;
  const rejected: RejectedEntry = {
    clientOperationId: operation.clientOperationId,
    organizationId: entry.organizationId,
    type: operation.type,
    label: labelOf(operation),
    code: reason.code,
    message: reason.message,
    at: new Date().toISOString(),
    operation,
    deviceId: entry.deviceId,
  };
  await idb.put(tx, STORES.rejected, rejected);
  const ticket = await idb.get<LocalTicket>(
    tx,
    STORES.tickets,
    operation.clientOperationId,
  );
  if (ticket)
    await idb.put(tx, STORES.tickets, {
      ...ticket,
      status: 'rejected',
      reason: rejected.message,
    });
}

/**
 * Proof of delivery (ADR-053): asks the server which of the latest sales
 * it really holds, and sends again those it does not (a restored backup,
 * for instance). Without an answer nothing changes.
 */
export async function verifyDelivered(organizationId: string): Promise<number> {
  const { sent, deviceId } = await transact(
    [STORES.tickets, STORES.snapshots],
    'readonly',
    async (tx) => {
      const tickets = await idb.getAll<LocalTicket>(tx, STORES.tickets);
      const snapshot = await idb.get<ShopSnapshot>(
        tx,
        STORES.snapshots,
        organizationId,
      );
      return {
        deviceId: snapshot?.device?.id ?? null,
        sent: tickets
          .filter(
            (t) =>
              t.organizationId === organizationId &&
              t.status === 'sent' &&
              t.operation,
          )
          .sort((a, b) => b.sale.occurredAt.localeCompare(a.sale.occurredAt))
          .slice(0, 200),
      };
    },
  );
  if (!deviceId || sent.length === 0) return 0;
  let response: Response;
  try {
    response = await fetch('/caisse/verifier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      body: JSON.stringify({
        organizationId,
        deviceId,
        clientOperationIds: sent.map((t) => t.clientOperationId),
      }),
    });
  } catch (error) {
    console.info('Vérification reportée : pas de réseau', error);
    return 0;
  }
  if (!response.ok) {
    console.warn('Vérification reportée', response.status);
    return 0;
  }
  const { unknown } = (await response.json()) as SyncCheckResponseDto;
  if (unknown.length === 0) return 0;
  await transact([STORES.outbox, STORES.tickets], 'readwrite', async (tx) => {
    for (const id of unknown) {
      const ticket = sent.find((t) => t.clientOperationId === id);
      if (ticket?.operation)
        await requeue(tx, organizationId, deviceId, {
          operation: ticket.operation,
        });
    }
  });
  console.warn('Ventes renvoyées au serveur', unknown.length);
  notify();
  return unknown.length;
}

/** How an operation is named on the phone when it is refused. */
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

async function applyResults(
  group: OutboxEntry[],
  results: SyncResponseDto['results'],
): Promise<void> {
  await transact(
    [STORES.outbox, STORES.rejected, STORES.tickets, STORES.snapshots],
    'readwrite',
    async (tx) => {
      for (const entry of group) {
        const result = results.find(
          (r) => r.clientOperationId === entry.operation.clientOperationId,
        );
        // Not answered, or not treated: it stays, and comes back later.
        if (!result || result.status === 'deferred') {
          await putBack(tx, entry);
          continue;
        }
        await idb.delete(tx, STORES.outbox, entry.seq!);
        if (result.status === 'rejected') {
          await keepRefused(tx, entry, {
            code: result.error?.code ?? 'REJECTED',
            message: result.error?.message ?? 'Refusée par le serveur.',
          });
          continue;
        }
        const ticket = await idb.get<LocalTicket>(
          tx,
          STORES.tickets,
          entry.operation.clientOperationId,
        );
        if (ticket)
          await idb.put(tx, STORES.tickets, {
            ...ticket,
            status: 'sent',
            saleId: result.saleId,
            saleNumber: result.saleNumber,
          });
        if (entry.operation.type === 'customer' && result.customerId) {
          const snapshot = await idb.get<ShopSnapshot>(
            tx,
            STORES.snapshots,
            entry.organizationId,
          );
          if (snapshot)
            await idb.put(tx, STORES.snapshots, {
              ...snapshot,
              customers: snapshot.customers.map((c) =>
                c.pendingOperationId === entry.operation.clientOperationId
                  ? {
                      ...c,
                      id: result.customerId!,
                      pendingOperationId: undefined,
                    }
                  : c,
              ),
            });
        }
      }
    },
  );
}
