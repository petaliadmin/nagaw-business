'use client';

import {
  roleHasPermission,
  ROLES,
  type CreateSaleInput,
  type CustomerDto,
  type DeviceDto,
  type ProductDto,
  type SaleDto,
  type SyncOperation,
  type SyncResponseDto,
  type SyncResultDto,
} from '@nagaw/shared';
import { ArrowLeft, ShoppingCart, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ShopMark } from '@/components/ui/shop-mark';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import {
  dismissRejected,
  flushOutbox,
  outboxStatus,
  OUTBOX_EVENT,
  readSnapshot,
  saveSnapshot,
  type RejectedEntry,
  type ShopSnapshot,
} from '@/lib/offline/store';
import { Checkout, type SaleDraft } from './checkout';

/**
 * The checkout sells online only for now (ADR-042): every sale is recorded
 * by the server before the seller sees it as done. The phone still sends
 * the operations an older version kept on it, so that none is lost.
 */
type State =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'server-error'; message: string }
  | { status: 'signed-out' }
  | { status: 'not-allowed' }
  | {
      status: 'ready';
      snapshot: ShopSnapshot;
      /** Why stock corrections are not available on this phone, if so. */
      deviceProblem: string | null;
    };

interface ServerData {
  organizationId: string;
  user: { id: string; email: string };
  shop: ShopSnapshot['shop'];
  products: ProductDto[];
  customers: CustomerDto[];
  devices: DeviceDto[];
  rules: NonNullable<ShopSnapshot['rules']>;
}

function deviceLabel(): string {
  const date = new Intl.DateTimeFormat('fr', { dateStyle: 'short' }).format(
    new Date(),
  );
  return `Appareil enregistré le ${date}`;
}

type RefreshFailure =
  | 'offline'
  | 'signed-out'
  | 'not-allowed'
  | 'device-limit'
  /** The server answered, with an error: not a network problem. */
  | 'server';

/**
 * The registration of this browser keeps one operation id per shop and
 * account, saved before the request: a reload, a second tab or a retry
 * gets the same device back instead of a new one (the offer's device
 * limit is not eaten by duplicates).
 */
const operationKey = (organizationId: string, userId: string) =>
  `nagaw:device-op:${organizationId}:${userId}`;

function operationIdFor(key: string): string {
  try {
    const kept = localStorage.getItem(key);
    if (kept) return kept;
    const created = crypto.randomUUID();
    localStorage.setItem(key, created);
    return created;
  } catch (error) {
    // Storage refused (private browsing): the in-tab guard still holds.
    console.warn('Identifiant d’appareil non conservé', error);
    return crypto.randomUUID();
  }
}

function forgetOperationId(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Identifiant d’appareil non effacé', error);
  }
}

/** The reason a route gave, in its `{ error }` body, for the screen. */
async function errorOf(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;
  return typeof body?.error === 'string' && body.error
    ? body.error
    : `erreur ${response.status}`;
}

type Registration =
  | { ok: true; device: DeviceDto }
  | { ok: false; reason: RefreshFailure; message?: string };

const registrations = new Map<string, Promise<Registration>>();

/** One registration at a time per shop and account in this tab. */
function registerDevice(
  organizationId: string,
  userId: string,
): Promise<Registration> {
  const key = operationKey(organizationId, userId);
  let running = registrations.get(key);
  if (!running) {
    running = requestDevice(organizationId, key).finally(() =>
      registrations.delete(key),
    );
    registrations.set(key, running);
  }
  return running;
}

async function requestDevice(
  organizationId: string,
  key: string,
): Promise<Registration> {
  // Twice at most: a removed device or a reused id asks for a new id.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch('/caisse/appareil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        label: deviceLabel(),
        clientOperationId: operationIdFor(key),
      }),
    });
    if (response.status === 401) return { ok: false, reason: 'signed-out' };
    if (response.status === 403) return { ok: false, reason: 'not-allowed' };
    if (response.status === 409) {
      const body = (await response.json().catch(() => null)) as {
        code?: string;
        error?: string;
      } | null;
      if (body?.code === 'CATALOG_LIMIT_REACHED')
        return { ok: false, reason: 'device-limit', message: body.error };
      forgetOperationId(key);
      continue;
    }
    if (!response.ok)
      return { ok: false, reason: 'server', message: await errorOf(response) };
    const device = (await response.json()) as DeviceDto;
    // A device a manager removed is never used again.
    if (device.revokedAt) {
      forgetOperationId(key);
      continue;
    }
    return { ok: true, device };
  }
  // The server answered twice with a device it would not let us use: a
  // server problem, never a missing network.
  return {
    ok: false,
    reason: 'server',
    message: 'ce téléphone n’a pas pu être enregistré comme caisse',
  };
}

/**
 * Fresh data from the server. The device of this browser (registered once)
 * only serves the stock corrections now (ADR-042): without it, the
 * checkout still sells, and says why corrections are not available.
 */
async function refresh(
  previous: ShopSnapshot | null,
): Promise<
  | { ok: true; snapshot: ShopSnapshot; deviceProblem: string | null }
  | { ok: false; reason: RefreshFailure; message?: string }
> {
  let response: Response;
  try {
    response = await fetch('/caisse/donnees', { cache: 'no-store' });
  } catch (error) {
    console.info('Caisse : pas de réseau', error);
    return { ok: false, reason: 'offline' };
  }
  if (response.status === 401) return { ok: false, reason: 'signed-out' };
  if (response.status === 403) return { ok: false, reason: 'not-allowed' };
  if (!response.ok)
    return { ok: false, reason: 'server', message: await errorOf(response) };
  const data = (await response.json()) as ServerData;

  // The list holds only this account's devices that are still allowed:
  // a device of another account, or a removed one, is not reused.
  let device =
    previous?.organizationId === data.organizationId && previous.device
      ? (data.devices.find((d) => d.id === previous.device?.id) ?? null)
      : null;
  let deviceProblem: string | null = null;
  if (!device) {
    let registered: Registration;
    try {
      registered = await registerDevice(data.organizationId, data.user.id);
    } catch (error) {
      console.warn('Appareil non enregistré : pas de réseau', error);
      registered = { ok: false, reason: 'offline' };
    }
    if (registered.ok) device = registered.device;
    else if (registered.reason === 'signed-out') return registered;
    else
      deviceProblem =
        registered.reason === 'offline'
          ? 'la connexion a coupé pendant l’enregistrement du téléphone'
          : (registered.message ?? 'ce téléphone n’est pas enregistré');
  }
  const snapshot = await saveSnapshot({
    organizationId: data.organizationId,
    shop: data.shop,
    products: data.products,
    customers: data.customers,
    device: device
      ? { id: device.id, ticketPrefix: device.ticketPrefix }
      : null,
    user: data.user,
    rules: data.rules,
  });
  return { ok: true, snapshot, deviceProblem };
}

/** Why the server refused, or why it could not be reached, for the seller. */
async function failureOf(response: Response): Promise<string> {
  if (response.status === 401)
    return 'Votre session a expiré : reconnectez-vous, puis refaites la vente.';
  return `Le serveur a refusé : ${await errorOf(response)}`;
}

const NO_NETWORK =
  'Pas de connexion internet : rien n’est enregistré. Vérifiez la connexion, puis appuyez de nouveau.';

/** One operation of the checkout, sent at once through the device. */
async function sendOperation(
  organizationId: string,
  deviceId: string,
  operation: SyncOperation,
): Promise<
  { ok: true; result: SyncResultDto } | { ok: false; message: string }
> {
  let response: Response;
  try {
    response = await fetch('/caisse/synchroniser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        deviceId,
        operations: [operation],
      }),
    });
  } catch (error) {
    console.info('Opération non envoyée : pas de réseau', error);
    return { ok: false, message: NO_NETWORK };
  }
  if (!response.ok) return { ok: false, message: await failureOf(response) };
  const { results } = (await response.json()) as SyncResponseDto;
  const result = results.find(
    (r) => r.clientOperationId === operation.clientOperationId,
  );
  if (!result)
    return { ok: false, message: 'Le serveur n’a pas répondu pour ce geste.' };
  if (result.status === 'rejected')
    return {
      ok: false,
      message: result.error?.message ?? 'Refusé par le serveur.',
    };
  return { ok: true, result };
}

export function CaisseApp() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [rejected, setRejected] = useState<RejectedEntry[]>([]);
  // The same sale sent again (after a cut network) keeps its operation id:
  // the server records it once (ADR-020).
  const lastSale = useRef<{ payload: string; id: string } | null>(null);

  const loadRejected = useCallback(async (organizationId: string) => {
    const status = await outboxStatus();
    setRejected(
      status.rejected.filter((r) => r.organizationId === organizationId),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Only to find this phone's device again: the checkout sells with
      // fresh data from the server, never with an old copy (ADR-042).
      const cached = await readSnapshot().catch((error: unknown) => {
        console.warn('Copie de la caisse illisible sur ce téléphone', error);
        return null;
      });
      const fresh = await refresh(cached);
      if (cancelled) return;
      if (fresh.ok) {
        setState({
          status: 'ready',
          snapshot: fresh.snapshot,
          deviceProblem: fresh.deviceProblem,
        });
        // Operations an older version kept on the phone leave now.
        void flushOutbox();
        await loadRejected(fresh.snapshot.organizationId);
      } else if (fresh.reason === 'server' || fresh.reason === 'device-limit') {
        setState({
          status: 'server-error',
          message: fresh.message ?? 'erreur inconnue',
        });
      } else {
        setState({
          status:
            fresh.reason === 'signed-out'
              ? 'signed-out'
              : fresh.reason === 'not-allowed'
                ? 'not-allowed'
                : 'offline',
        });
      }
    })().catch((error: unknown) => {
      console.error('Ouverture de la caisse impossible', error);
      if (!cancelled)
        setState({
          status: 'server-error',
          message: error instanceof Error ? error.message : 'erreur inconnue',
        });
    });
    return () => {
      cancelled = true;
    };
  }, [loadRejected]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const organizationId = state.snapshot.organizationId;
    const update = () => void loadRejected(organizationId);
    window.addEventListener(OUTBOX_EVENT, update);
    return () => window.removeEventListener(OUTBOX_EVENT, update);
  }, [state, loadRejected]);

  // Without the server, try again by itself: every 15 s and as soon as
  // the network comes back. Nobody has to find « Réessayer ».
  const waiting = state.status === 'offline' || state.status === 'server-error';
  useEffect(() => {
    if (!waiting) return;
    const retry = () => window.location.reload();
    const timer = window.setTimeout(retry, 15_000);
    window.addEventListener('online', retry);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('online', retry);
    };
  }, [waiting]);

  if (state.status === 'loading')
    return (
      <p role="status" className="p-6 text-lg">
        Ouverture de la caisse…
      </p>
    );
  if (state.status === 'signed-out')
    return (
      <Centered>
        <Alert>Connectez-vous pour ouvrir la caisse.</Alert>
        <Link
          href="/connexion?next=/caisse"
          className={buttonClasses('primary')}
        >
          Se connecter
        </Link>
      </Centered>
    );
  if (state.status === 'not-allowed')
    return (
      <Centered>
        <Alert>
          Votre rôle permet de consulter les ventes, pas d’en enregistrer.
        </Alert>
        <Link href="/espace" className={buttonClasses('secondary')}>
          Revenir à l’accueil
        </Link>
      </Centered>
    );
  if (state.status === 'server-error')
    return (
      <Centered>
        <Alert tone="error">
          Vous êtes connecté, mais le serveur n’a pas pu préparer la caisse :{' '}
          {state.message}. Réessayez dans un instant ; si cela continue,
          prévenez l’équipe avec « Donner mon avis ».
        </Alert>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={buttonClasses('primary')}
        >
          Réessayer
        </button>
        <p role="status" className="text-center text-ink-muted">
          Nouvel essai automatique dans quelques secondes.
        </p>
      </Centered>
    );
  if (state.status === 'offline')
    return (
      <Centered>
        <Alert tone="warning">
          Pas de connexion internet. La caisse a besoin d’internet pour
          enregistrer les ventes : vérifiez les données mobiles ou le wifi.
        </Alert>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={buttonClasses('primary')}
        >
          Réessayer
        </button>
        <p role="status" className="text-center text-ink-muted">
          Nouvel essai automatique dans quelques secondes.
        </p>
      </Centered>
    );

  const { snapshot, deviceProblem } = state;

  /** Sends the sale and waits for the server: done only once recorded. */
  async function onRecord(draft: SaleDraft): Promise<string | null> {
    const sale: Omit<CreateSaleInput, 'clientOperationId'> = {
      customerId: draft.customer?.id ?? null,
      lines: draft.lines.map(({ product, option, quantity, agreedTotal }) => ({
        productId: product.id,
        productUnitId: option.productUnitId,
        conversion: option.conversion,
        quantity,
        agreedTotal,
      })),
      discount: draft.totals.discount,
      payments: draft.payments,
      cashReceived: draft.cashReceived,
      expectedTotal: draft.totals.total,
    };
    const payload = JSON.stringify(sale);
    if (lastSale.current?.payload !== payload)
      lastSale.current = { payload, id: crypto.randomUUID() };
    let response: Response;
    try {
      response = await fetch('/caisse/vente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: snapshot.organizationId,
          sale: { ...sale, clientOperationId: lastSale.current.id },
        }),
      });
    } catch (error) {
      console.info('Vente non envoyée : pas de réseau', error);
      return NO_NETWORK;
    }
    if (!response.ok) return failureOf(response);
    const recorded = (await response.json()) as SaleDto;
    lastSale.current = null;
    router.push(`/espace/ventes/${recorded.id}?nouvelle=1`);
    return null;
  }

  // The role saved with the shop data decides what the checkout offers;
  // the server checks again when the operation arrives (ADR-036).
  const role = ROLES.find((r) => r === snapshot.shop.role);
  const stockRights = {
    canCorrect: role !== undefined && roleHasPermission(role, 'stock.correct'),
    manager: role !== undefined && roleHasPermission(role, 'stock.move'),
    max: snapshot.rules?.stockCorrectionMax ?? 0,
  };
  // Negotiation rules (ADR-038), checked again by the server.
  const negotiation = {
    manager: role !== undefined && roleHasPermission(role, 'sales.cancel'),
    maxDiscountBasisPoints: snapshot.rules?.maxDiscountBasisPoints ?? null,
    sellerCanSellBelowCost: snapshot.rules?.sellerCanSellBelowCost ?? false,
  };

  async function onCorrectStock(
    product: ProductDto,
    counted: number,
    reason: string,
  ): Promise<string | null> {
    if (!snapshot.device)
      return `Correction impossible sur ce téléphone : ${deviceProblem ?? 'il n’est pas enregistré comme caisse'}. Rechargez la caisse, ou corrigez le stock depuis la fiche du produit.`;
    const sent = await sendOperation(
      snapshot.organizationId,
      snapshot.device.id,
      {
        type: 'stock_correction',
        clientOperationId: crypto.randomUUID(),
        data: {
          productId: product.id,
          quantity: Math.round((counted - product.stockQuantity) * 1000) / 1000,
          countedQuantity: counted,
          reason,
          occurredAt: new Date().toISOString(),
        },
      },
    );
    if (!sent.ok) return sent.message;
    const stockQuantity = sent.result.stockQuantity ?? counted;
    setState((current) =>
      current.status === 'ready'
        ? {
            ...current,
            snapshot: {
              ...current.snapshot,
              products: current.snapshot.products.map((p) =>
                p.id === product.id ? { ...p, stockQuantity } : p,
              ),
            },
          }
        : current,
    );
    return null;
  }

  /** Created on the server at once, then chosen for the sale. */
  async function onCreateCustomer(values: {
    name: string;
    phone: string;
  }): Promise<
    { ok: true; customer: CustomerDto } | { ok: false; message: string }
  > {
    const name = values.name.trim();
    if (!name) return { ok: false, message: 'Donnez le nom du client.' };
    let response: Response;
    try {
      response = await fetch('/caisse/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: snapshot.organizationId,
          customer: {
            name: name.slice(0, 120),
            phone: values.phone.trim().slice(0, 30),
            clientOperationId: crypto.randomUUID(),
          },
        }),
      });
    } catch (error) {
      console.info('Client non créé : pas de réseau', error);
      return { ok: false, message: NO_NETWORK };
    }
    if (!response.ok) return { ok: false, message: await failureOf(response) };
    const customer = (await response.json()) as CustomerDto;
    setState((current) =>
      current.status === 'ready'
        ? {
            ...current,
            snapshot: {
              ...current.snapshot,
              customers: [...current.snapshot.customers, customer],
            },
          }
        : current,
    );
    return { ok: true, customer };
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex min-h-[calc(4rem+env(safe-area-inset-top))] items-center gap-3 border-b border-line bg-surface px-4 pt-[env(safe-area-inset-top)] print:hidden">
        <Link
          href="/espace"
          className="flex min-h-12 items-center gap-2 rounded-xl px-2 font-bold text-brand-ink"
        >
          <ArrowLeft aria-hidden className="size-6" />
          Accueil
        </Link>
        <ShopMark version={snapshot.shop.logoVersion} />
        <span className="min-w-0 flex-1 truncate text-lg font-extrabold">
          {snapshot.shop.name}
        </span>
        <span className="flex items-center gap-2 text-base font-semibold text-sales-ink">
          <ShoppingCart aria-hidden className="size-5" />
          Caisse
        </span>
      </header>
      <main
        id="contenu"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pt-4 pb-40 lg:pb-8"
      >
        {rejected.length > 0 && (
          <section
            aria-labelledby="rejected-title"
            className="flex flex-col gap-3 rounded-2xl border-l-4 border-danger bg-danger-soft p-4 text-danger-ink"
          >
            <h2
              id="rejected-title"
              className="flex items-center gap-2 text-lg font-bold"
            >
              <TriangleAlert aria-hidden className="size-6" />
              {rejected.length === 1
                ? 'Une opération refusée'
                : `${rejected.length} opérations refusées`}
            </h2>
            <ul className="flex flex-col gap-2">
              {rejected.map((entry) => (
                <li
                  key={entry.clientOperationId}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span>
                    <strong>{entry.label}</strong> : {entry.message}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void dismissRejected(entry.clientOperationId)
                    }
                    className={buttonClasses('secondary')}
                  >
                    J’ai compris
                  </button>
                </li>
              ))}
            </ul>
            <p>
              Montrez ce message au propriétaire ou au gérant de la boutique.
            </p>
          </section>
        )}
        <h1 className="text-2xl font-extrabold md:text-3xl">Vendre</h1>
        <Checkout
          noun={snapshot.shop.offer === 'services' ? 'service' : 'produit'}
          currency={snapshot.shop.currency}
          products={snapshot.products}
          customers={snapshot.customers}
          stockRights={stockRights}
          negotiation={negotiation}
          onRecord={onRecord}
          onCreateCustomer={onCreateCustomer}
          onCorrectStock={onCorrectStock}
        />
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="contenu"
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-10"
    >
      {children}
    </main>
  );
}
