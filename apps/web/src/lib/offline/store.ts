import {
  formatDeviceTicket,
  type CustomerDto,
  type PaymentInput,
  type ProductDto,
  type SyncOperation,
  type SyncResponseDto,
  type ShopOffer,
} from '@nagaw/shared';
import { idb, STORES, transact } from './db';
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
  };
  products: ProductDto[];
  /** `pendingOperationId`: created on this device, not yet sent. */
  customers: (CustomerDto & { pendingOperationId?: string })[];
  device: { id: string; ticketPrefix: string } | null;
  /** The account the device belongs to (absent in older copies). */
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
  deviceId: string;
  operation: SyncOperation;
  createdAt: string;
  /** Account that recorded it, to say whose sales are stuck. */
  userEmail?: string;
}

/**
 * Why the server refuses every operation of a device: it belongs to
 * another account (`DEVICE_NOT_FOUND`) or a manager removed it
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
}

const ACTIVE_KEY = '__active';
const BLOCKED_KEY = '__blocked';
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
        nextTicket: sameDevice ? (previous?.nextTicket ?? 1) : 1,
        refreshedAt: new Date().toISOString(),
      };
      await idb.put(tx, STORES.snapshots, snapshot);
      await idb.put(tx, STORES.snapshots, {
        organizationId: ACTIVE_KEY,
        value: fresh.organizationId,
      });
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
 * the ticket for display.
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
      if (!snapshot?.device) throw new Error('Appareil non enregistré');
      const deviceTicket = formatDeviceTicket(
        snapshot.device.ticketPrefix,
        snapshot.nextTicket,
      );
      const { operations, ticket: draft } = build(deviceTicket);
      await idb.put(tx, STORES.snapshots, {
        ...snapshot,
        products: applyPendingStock(snapshot.products, operations),
        nextTicket: snapshot.nextTicket + 1,
      });
      for (const operation of operations) {
        const entry: OutboxEntry = {
          organizationId,
          deviceId: snapshot.device.id,
          operation,
          createdAt: new Date().toISOString(),
          userEmail: snapshot.user?.email,
        };
        await idb.add(tx, STORES.outbox, entry);
      }
      const local: LocalTicket = {
        ...draft,
        deviceTicket,
        organizationId,
        status: 'pending',
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
      if (!snapshot?.device) throw new Error('Appareil non enregistré');
      const next: ShopSnapshot = {
        ...snapshot,
        products: applyPendingStock(snapshot.products, [operation]),
      };
      await idb.put(tx, STORES.snapshots, next);
      const entry: OutboxEntry = {
        organizationId,
        deviceId: snapshot.device.id,
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
    if (!snapshot?.device) throw new Error('Appareil non enregistré');
    await idb.put(tx, STORES.snapshots, {
      ...snapshot,
      customers: [...snapshot.customers, customer],
    });
    const entry: OutboxEntry = {
      organizationId,
      deviceId: snapshot.device.id,
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

// ---------------------------------------------------------------------------
// Status and synchronization
// ---------------------------------------------------------------------------

export interface OutboxStatus {
  /** Sales that will leave with the next sending. */
  pendingSales: number;
  pendingOther: number;
  rejected: RejectedEntry[];
  /** Sales kept on a device the server refuses, with the reason. */
  blocked: (BlockedDevice & { sales: number; email: string | null })[];
}

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
        blocked: blockedDevices.map((b) => {
          const mine = pending.filter((e) => e.deviceId === b.deviceId);
          return {
            ...b,
            sales: mine.filter((e) => e.operation.type === 'sale').length,
            email: mine.find((e) => e.userEmail)?.userEmail ?? null,
          };
        }),
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

export type FlushOutcome =
  'empty' | 'sent' | 'offline' | 'signed-out' | 'device-refused';

let flushing: Promise<FlushOutcome> | null = null;

/**
 * Sends the queued operations, oldest first, 50 at a time, and applies the
 * answers. Only one flush runs at a time; operations stay queued on any
 * network or session problem (nothing is ever lost).
 */
export function flushOutbox(): Promise<FlushOutcome> {
  flushing ??= runFlush().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function runFlush(): Promise<FlushOutcome> {
  let sentAny = false;
  let refusedAny = false;
  // A device the server refuses is set aside for this round: the other
  // devices' operations (another account on the same phone) still leave.
  const skipped = new Set<string>();
  const key = (e: OutboxEntry) => `${e.organizationId}:${e.deviceId}`;
  for (;;) {
    const batch = await transact([STORES.outbox], 'readonly', async (tx) =>
      (await idb.getAll<OutboxEntry>(tx, STORES.outbox))
        .filter((e) => !skipped.has(key(e)))
        .slice(0, 50),
    );
    if (batch.length === 0)
      return sentAny ? 'sent' : refusedAny ? 'device-refused' : 'empty';
    // One device and one shop per request.
    const { deviceId, organizationId } = batch[0]!;
    const group = batch.filter(
      (e) => e.deviceId === deviceId && e.organizationId === organizationId,
    );

    let response: Response;
    try {
      response = await fetch('/caisse/synchroniser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          deviceId,
          operations: group.map((e) => e.operation),
        }),
      });
    } catch (error) {
      console.info('Synchronisation reportée : pas de réseau', error);
      return sentAny ? 'sent' : 'offline';
    }
    if (response.status === 401) return 'signed-out';
    if (response.status === 403 || response.status === 404) {
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
      skipped.add(key(group[0]!));
      refusedAny = true;
      notify();
      continue;
    }
    if (!response.ok) {
      console.warn('Synchronisation reportée', response.status);
      return sentAny ? 'sent' : 'offline';
    }
    const { results } = (await response.json()) as SyncResponseDto;
    await applyResults(group, results);
    // Accepted again (the right account came back): no longer blocked.
    await setBlocked((current) =>
      current.filter((b) => b.deviceId !== deviceId),
    );
    sentAny = true;
    notify();
  }
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
        // Not answered (should not happen): stays queued for the next time.
        if (!result) continue;
        await idb.delete(tx, STORES.outbox, entry.seq!);
        const ticket = await idb.get<LocalTicket>(
          tx,
          STORES.tickets,
          entry.operation.clientOperationId,
        );
        if (result.status === 'rejected') {
          const rejected: RejectedEntry = {
            clientOperationId: entry.operation.clientOperationId,
            organizationId: entry.organizationId,
            type: entry.operation.type,
            label: labelOf(entry.operation),
            code: result.error?.code ?? 'REJECTED',
            message: result.error?.message ?? 'Refusée par le serveur.',
            at: new Date().toISOString(),
          };
          await idb.put(tx, STORES.rejected, rejected);
          if (ticket)
            await idb.put(tx, STORES.tickets, {
              ...ticket,
              status: 'rejected',
              reason: rejected.message,
            });
        } else if (ticket) {
          await idb.put(tx, STORES.tickets, {
            ...ticket,
            status: 'sent',
            saleId: result.saleId,
            saleNumber: result.saleNumber,
          });
        }
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
