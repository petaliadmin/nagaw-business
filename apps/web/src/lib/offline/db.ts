/**
 * Minimal promise wrapper around IndexedDB (ADR-020). One database per
 * browser profile; data of a shop is keyed by its organization id, and
 * everything is erased at sign-out.
 */
const DB_NAME = 'nagaw';
const DB_VERSION = 1;

export const STORES = {
  /** Snapshot of a shop for the checkout: products, customers, device. */
  snapshots: 'snapshots',
  /** Operations waiting to be sent, in order. */
  outbox: 'outbox',
  /** Operations the server refused, with the reason. */
  rejected: 'rejected',
  /** Tickets of sales recorded on this device. */
  tickets: 'tickets',
} as const;
type Store = (typeof STORES)[keyof typeof STORES];

let opening: Promise<IDBDatabase> | null = null;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB error'));
  });
}

export function openDb(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore(STORES.snapshots, { keyPath: 'organizationId' });
      db.createObjectStore(STORES.outbox, {
        keyPath: 'seq',
        autoIncrement: true,
      });
      db.createObjectStore(STORES.rejected, { keyPath: 'clientOperationId' });
      db.createObjectStore(STORES.tickets, { keyPath: 'clientOperationId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error ?? new Error('Ouverture de la base locale impossible'));
    };
  });
  return opening;
}

/** Runs `work` in one transaction; resolves when it is committed. */
export async function transact<T>(
  stores: Store[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(stores, mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Transaction IndexedDB'));
    tx.onabort = () => reject(tx.error ?? new Error('Transaction annulée'));
  });
  const result = await work(tx);
  await done;
  return result;
}

export const idb = {
  get: <T>(tx: IDBTransaction, store: Store, key: IDBValidKey) =>
    request<T | undefined>(
      tx.objectStore(store).get(key) as IDBRequest<T | undefined>,
    ),
  getAll: <T>(tx: IDBTransaction, store: Store) =>
    request<T[]>(tx.objectStore(store).getAll() as IDBRequest<T[]>),
  put: (tx: IDBTransaction, store: Store, value: unknown) =>
    request(tx.objectStore(store).put(value)),
  add: (tx: IDBTransaction, store: Store, value: unknown) =>
    request(tx.objectStore(store).add(value)),
  delete: (tx: IDBTransaction, store: Store, key: IDBValidKey) =>
    request(tx.objectStore(store).delete(key)),
  count: (tx: IDBTransaction, store: Store) =>
    request(tx.objectStore(store).count()),
};

/** Erases every local copy (sign-out, shared phone). */
export async function eraseLocalData(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  if (opening) {
    (await opening).close();
    opening = null;
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('Effacement impossible'));
    // Another tab still holds the base: it is erased once that tab closes.
    req.onblocked = () => resolve();
  });
}
