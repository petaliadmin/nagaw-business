'use client';

import {
  formatAmount,
  roleHasPermission,
  ROLES,
  type CustomerDto,
  type DeviceDto,
  type ProductDto,
  type SaleDto,
  type SyncOperation,
} from '@nagaw/shared';
import {
  CheckCircle2,
  CloudUpload,
  LogOut,
  ReceiptText,
  RotateCcw,
  ShoppingCart,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ShopMark } from '@/components/ui/shop-mark';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import {
  addLocalCustomer,
  clearShopCopy,
  correctStockLocally,
  dismissRejected,
  flushOutbox,
  flushOutboxNow,
  isCheckoutLocked,
  keepLocalData,
  listTickets,
  outboxStatus,
  OUTBOX_EVENT,
  readSnapshot,
  readTicket,
  recordLocally,
  retryRejected,
  saveSnapshot,
  verifyDelivered,
  type LocalTicket,
  type RejectedEntry,
  type ShopSnapshot,
} from '@/lib/offline/store';
import { classifyAnswer } from '@/lib/offline/delivery';
import { Checkout, type SaleDraft } from './checkout';
import { LocalTicketView } from './local-ticket';

/**
 * The phone is the reference (ADR-053): the checkout opens from what it
 * keeps, every sale is written here first, and the network only ever
 * happens in the background. The server checks what arrives.
 *
 * Selling without internet is suspended (ADR-057): the checkout opens only
 * once the server answered, and refuses a sale while the phone has no
 * network. A sale whose sending fails on the way is still kept here and
 * sent later, under the same operation id.
 */
type State =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'server-error'; message: string }
  | { status: 'signed-out' }
  | { status: 'not-allowed' }
  | { status: 'device-revoked' }
  | {
      status: 'ready';
      snapshot: ShopSnapshot;
      /** False once the server could not refresh this copy. */
      fresh: boolean;
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
  /** A manager withdrew this phone: it stays out until one brings it back. */
  | 'revoked'
  /** The server answered, with an error: not a network problem. */
  | 'server';

/**
 * The registration of this browser keeps one operation id per shop, saved
 * before the request: a reload, a second tab, a retry or another person on
 * this phone gets the same device back (ADR-053).
 */
const operationKey = (organizationId: string) =>
  `nagaw:device-op:${organizationId}`;

function operationIdFor(key: string): string {
  try {
    const kept = localStorage.getItem(key);
    if (kept) return kept;
    // Older versions kept one id per account: the phone stays the same.
    const legacy = Object.keys(localStorage).find((k) =>
      k.startsWith(`${key}:`),
    );
    const created =
      (legacy ? localStorage.getItem(legacy) : null) ?? crypto.randomUUID();
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

/** One registration at a time per shop in this tab. */
function registerDevice(organizationId: string): Promise<Registration> {
  const key = operationKey(organizationId);
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
      redirect: 'manual',
      body: JSON.stringify({
        organizationId,
        label: deviceLabel(),
        clientOperationId: operationIdFor(key),
      }),
    });
    if (classifyAnswer(response.status) === 'session')
      return { ok: false, reason: 'signed-out' };
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
    if (device.revokedAt) return { ok: false, reason: 'revoked' };
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

/** How long the shop data may take: a slow network never holds anything. */
const REFRESH_TIMEOUT_MS = 20_000;

/**
 * Fresh data from the server. Selling needs none of it: a failure leaves
 * the phone's copy as it is. Without a device from the server, the phone
 * sells anyway and sends once it has one (ADR-053).
 */
async function refresh(
  previous: ShopSnapshot | null,
): Promise<
  | { ok: true; snapshot: ShopSnapshot }
  | { ok: false; reason: RefreshFailure; message?: string }
> {
  let response: Response;
  try {
    response = await fetch('/caisse/donnees', {
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
  } catch (error) {
    console.info('Caisse : données du téléphone', error);
    return { ok: false, reason: 'offline' };
  }
  if (classifyAnswer(response.status) === 'session')
    return { ok: false, reason: 'signed-out' };
  if (response.status === 403) return { ok: false, reason: 'not-allowed' };
  if (!response.ok)
    return { ok: false, reason: 'server', message: await errorOf(response) };
  const data = (await response.json()) as ServerData;

  const known =
    previous?.organizationId === data.organizationId ? previous.device : null;
  // The list holds this person's devices still allowed. Any other phone
  // goes through the registration, which finds the same device again.
  let device: ShopSnapshot['device'] = known
    ? (data.devices.find((d) => d.id === known.id) ?? null)
    : null;
  if (!device) {
    let registered: Registration;
    try {
      registered = await registerDevice(data.organizationId);
    } catch (error) {
      console.warn('Appareil non enregistré : pas de réseau', error);
      registered = { ok: false, reason: 'offline' };
    }
    if (registered.ok) device = registered.device;
    else if (
      registered.reason === 'signed-out' ||
      registered.reason === 'revoked'
    )
      return registered;
    else device = known;
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
  return { ok: true, snapshot };
}

/** A local ticket in the shape of a server sale, for printing and sharing. */
function asSale(ticket: LocalTicket): SaleDto {
  return {
    id: ticket.clientOperationId,
    saleNumber: ticket.saleNumber ?? 0,
    status: 'completed',
    customer: ticket.sale.customerName
      ? {
          id: '',
          name: ticket.sale.customerName,
          phone: ticket.sale.customerPhone ?? '',
        }
      : null,
    seller: { userId: '', email: '' },
    lines: ticket.sale.lines.map((line, index) => ({
      position: index + 1,
      productId: '',
      label: line.label,
      unit: line.unit,
      productUnitId: line.productUnitId ?? null,
      unitLabel: line.unitLabel ?? null,
      unitFactor: line.unitFactor ?? 1,
      priceBasis: line.priceBasis ?? 'unit',
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      baseQuantity:
        Math.round(line.quantity * (line.unitFactor ?? 1) * 1000) / 1000,
      listTotal: line.listTotal ?? line.lineTotal,
      lineTotal: line.lineTotal,
      taxRateBasisPoints: null,
      taxAmount: 0,
    })),
    payments: ticket.sale.payments.map((p) => ({
      method: p.method,
      provider: p.provider,
      reference: p.reference,
      amount: p.amount,
    })),
    subtotal: ticket.sale.subtotal,
    discount: ticket.sale.discount,
    total: ticket.sale.total,
    taxTotal: ticket.sale.taxTotal,
    cashReceived: ticket.sale.cashReceived,
    changeGiven:
      ticket.sale.cashReceived === null
        ? null
        : ticket.sale.cashReceived -
          ticket.sale.payments
            .filter((p) => p.method === 'cash')
            .reduce((sum, p) => sum + p.amount, 0),
    occurredAt: ticket.sale.occurredAt,
    deviceTicket: ticket.deviceTicket,
    priceReview: false,
    stockReview: false,
    cancellation: null,
  };
}

/** Said when the phone has no network at the moment of writing. */
const NO_NETWORK =
  'Pas de connexion internet : rien n’est enregistré. Pour l’instant, la caisse demande internet. Votre panier est gardé : validez à nouveau quand le réseau revient.';

const TICKET_STATUS: Record<
  LocalTicket['status'],
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  sent: { label: 'Envoyée', className: 'text-sales-ink', icon: CheckCircle2 },
  pending: {
    label: 'En attente',
    className: 'text-warning-ink',
    icon: CloudUpload,
  },
  rejected: {
    label: 'Refusée',
    className: 'text-danger-ink',
    icon: TriangleAlert,
  },
};

/** Everything sold on this phone, readable without network (ADR-053). */
/**
 * The sales of this phone, inside the checkout: the seller opens one to
 * print it or send it again, without leaving the checkout.
 */
function SalesView({
  tickets,
  money,
  onOpen,
}: {
  tickets: LocalTicket[];
  money: (value: number) => string;
  onOpen: (ticket: LocalTicket) => void;
}) {
  return (
    <section
      aria-labelledby="sales-view-title"
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm print:hidden"
    >
      <h2 id="sales-view-title" className="text-xl font-bold">
        Ventes de ce téléphone
      </h2>
      {tickets.length === 0 ? (
        <p className="text-ink-muted">
          Aucune vente pour l’instant. Les ventes faites ici s’affichent dans
          cette liste.
        </p>
      ) : (
        <ul
          aria-label="Ventes de ce téléphone"
          className="flex flex-col divide-y divide-line"
        >
          {tickets.map((ticket) => {
            const status = TICKET_STATUS[ticket.status];
            return (
              <li key={ticket.clientOperationId}>
                <button
                  type="button"
                  onClick={() => onOpen(ticket)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {ticket.deviceTicket}
                    </span>
                    <span
                      className={`flex items-center gap-1 font-semibold ${status.className}`}
                    >
                      <status.icon aria-hidden className="size-5 shrink-0" />
                      {status.label}
                    </span>
                  </span>
                  <span className="font-bold tabular-nums">
                    {money(ticket.sale.total)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function CaisseApp() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [ticket, setTicket] = useState<LocalTicket | null>(null);
  // Selling, or the sales of this phone: both inside the checkout.
  const [view, setView] = useState<'sell' | 'sales'>('sell');
  const [confirm, confirmDialog] = useConfirm();
  /** The only way out of the checkout: explicit, after a question. */
  async function quit() {
    const ok = await confirm({
      title: 'Quitter la caisse ?',
      message:
        'Les ventes faites restent enregistrées. Un panier en cours sera perdu.',
      confirmLabel: 'Quitter la caisse',
      tone: 'primary',
    });
    if (ok) router.push('/espace');
  }
  const [tickets, setTickets] = useState<LocalTicket[]>([]);
  const [rejected, setRejected] = useState<RejectedEntry[]>([]);

  const loadRejected = useCallback(async (organizationId: string) => {
    const status = await outboxStatus();
    setRejected(
      status.rejected.filter((r) => r.organizationId === organizationId),
    );
    setTickets(await listTickets(organizationId));
  }, []);

  /** Fresh data, then what waits on the phone, then the proof of delivery. */
  const syncWithServer = useCallback(
    async (cached: ShopSnapshot | null, asked = false) => {
      const fresh = await refresh(cached);
      if (fresh.ok) {
        setState({ status: 'ready', snapshot: fresh.snapshot, fresh: true });
        await (asked ? flushOutboxNow() : flushOutbox());
        await verifyDelivered(fresh.snapshot.organizationId);
        await flushOutbox();
        await loadRejected(fresh.snapshot.organizationId);
      } else if (fresh.reason === 'revoked') {
        if (cached) await clearShopCopy(cached.organizationId);
        setState({ status: 'device-revoked' });
      }
      return fresh;
    },
    [loadRejected],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      void keepLocalData();
      const [cached, locked] = await Promise.all([
        readSnapshot(),
        isCheckoutLocked(),
      ]).catch((error: unknown) => {
        console.warn('Copie de la caisse illisible sur ce téléphone', error);
        return [null, false] as const;
      });
      // The checkout opens on the server's answer only (ADR-057). The
      // phone's copy still gives the device, the ticket counter and what
      // waits to be sent.
      const fresh = await syncWithServer(cached);
      if (cancelled || fresh.ok || fresh.reason === 'revoked') return;
      if (locked) {
        setState({ status: 'signed-out' });
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
      if (cancelled) return;
      // What fails behind an open checkout never closes it.
      setState((current) =>
        current.status === 'ready'
          ? current
          : {
              status: 'server-error',
              message:
                error instanceof Error ? error.message : 'erreur inconnue',
            },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [loadRejected, syncWithServer]);

  const openShop = state.status === 'ready' ? state.snapshot : null;
  const openShopId = openShop?.organizationId;
  const latest = useRef(openShop);
  useEffect(() => {
    latest.current = openShop;
  }, [openShop]);
  useEffect(() => {
    if (!openShopId) return;
    const update = () => void loadRejected(openShopId);
    // The network came back: the copy of the phone catches up by itself.
    const reconnect = () => void syncWithServer(latest.current);
    window.addEventListener(OUTBOX_EVENT, update);
    window.addEventListener('online', reconnect);
    return () => {
      window.removeEventListener(OUTBOX_EVENT, update);
      window.removeEventListener('online', reconnect);
    };
  }, [openShopId, loadRejected, syncWithServer]);

  // Closed for want of the server, try again by itself: every 15 s and as
  // soon as the network comes back. Nobody has to find « Réessayer ».
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

  // « Nouvelle vente » disappears with the ticket: the focus goes back to
  // the top of the checkout instead of the start of the page (WCAG 2.4.3).
  const sellTitleRef = useRef<HTMLHeadingElement>(null);
  const backToSell = useRef(false);
  useEffect(() => {
    if (ticket || !backToSell.current) return;
    backToSell.current = false;
    sellTitleRef.current?.focus();
  }, [ticket]);

  if (state.status === 'loading')
    return (
      <p role="status" className="p-6 text-lg">
        Ouverture de la caisse…
      </p>
    );
  if (state.status === 'signed-out')
    return (
      <Centered>
        <Alert>
          Connectez-vous pour ouvrir la caisse. Ce que garde ce téléphone reste
          gardé.
        </Alert>
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
  if (state.status === 'device-revoked')
    return (
      <Centered>
        <Alert tone="error">
          Ce téléphone a été retiré de la boutique par un gérant : sa caisse est
          fermée. Le propriétaire ou un gérant peut le remettre dans Paramètres,
          « Appareils de vente ».
        </Alert>
        <Link href="/espace" className={buttonClasses('secondary')}>
          Revenir à l’accueil
        </Link>
      </Centered>
    );
  if (state.status === 'offline')
    return (
      <Centered>
        <Alert tone="warning">
          Pas de connexion internet. Pour l’instant, la caisse demande internet
          pour vendre : elle s’ouvrira dès que le réseau revient.
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

  const { snapshot } = state;
  const money = (value: number) => formatAmount(value, snapshot.shop.currency);

  /** What the phone holds now, after something was written on it. */
  async function reloadSnapshot(): Promise<void> {
    const updated = await readSnapshot(snapshot.organizationId);
    if (updated)
      setState((current) =>
        current.status === 'ready'
          ? { ...current, snapshot: updated }
          : current,
      );
  }

  /**
   * Refused without network (ADR-057); otherwise written on the phone
   * first, then sent at once, and the seller waits for the answer.
   */
  async function onRecord(draft: SaleDraft): Promise<string | null> {
    if (!navigator.onLine) return NO_NETWORK;
    const pendingCustomer = draft.customer
      ? snapshot.customers.find(
          (c) => c.id === draft.customer?.id && c.pendingOperationId,
        )
      : undefined;
    const clientOperationId = crypto.randomUUID();
    let local: LocalTicket;
    try {
      local = await recordLocally(snapshot.organizationId, (deviceTicket) => {
        const operation: SyncOperation = {
          type: 'sale',
          clientOperationId,
          data: {
            deviceTicket,
            occurredAt: new Date().toISOString(),
            recordedBy: snapshot.user?.id ?? null,
            customerId: pendingCustomer ? null : (draft.customer?.id ?? null),
            customerOperationId: pendingCustomer?.pendingOperationId ?? null,
            lines: draft.lines.map(
              ({ product, option, quantity, pricing, agreedTotal }) => ({
                productId: product.id,
                productUnitId: option.productUnitId,
                conversion: option.conversion,
                quantity,
                unitPrice: pricing.unitPrice,
                agreedTotal,
              }),
            ),
            discount: draft.totals.discount,
            payments: draft.payments,
            cashReceived: draft.cashReceived,
          },
        };
        return {
          operations: [operation],
          ticket: {
            clientOperationId,
            sale: {
              occurredAt: operation.data.occurredAt,
              customerName: draft.customer?.name ?? null,
              customerPhone: draft.customer?.phone ?? null,
              lines: draft.lines.map(
                ({
                  product,
                  option,
                  quantity,
                  pricing,
                  lineTotal,
                  listTotal,
                }) => ({
                  label: product.name,
                  unit: product.unit,
                  quantity,
                  unitPrice: pricing.unitPrice,
                  lineTotal,
                  productUnitId: option.productUnitId,
                  unitLabel: option.label,
                  unitFactor: option.factor,
                  priceBasis: pricing.basis,
                  listTotal,
                }),
              ),
              subtotal: draft.totals.subtotal,
              discount: draft.totals.discount,
              total: draft.totals.total,
              taxTotal: draft.totals.taxTotal,
              payments: draft.payments,
              cashReceived: draft.cashReceived,
            },
          },
        };
      });
    } catch (error) {
      console.error('Vente non enregistrée sur l’appareil', error);
      return 'La vente n’a pas pu être gardée sur ce téléphone : son stockage est peut-être plein. Rien n’est enregistré.';
    }
    await reloadSnapshot();
    // A new round, so that this sale is in it; each sending has a delay.
    await flushOutboxNow();
    const sent = await readTicket(clientOperationId);
    // The ticket shows in the checkout, sent or not: the seller prints or
    // sends it, then starts the next sale, without leaving. Refused or
    // lost on the way, it says so, and the phone keeps the sale under its
    // operation id, never sent twice.
    setTicket(sent ?? local);
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
    if (!navigator.onLine) return NO_NETWORK;
    try {
      await correctStockLocally(snapshot.organizationId, {
        type: 'stock_correction',
        clientOperationId: crypto.randomUUID(),
        data: {
          productId: product.id,
          quantity: Math.round((counted - product.stockQuantity) * 1000) / 1000,
          countedQuantity: counted,
          reason,
          occurredAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Correction de stock non enregistrée', error);
      return 'La correction n’a pas pu être gardée sur ce téléphone.';
    }
    await reloadSnapshot();
    // Sent with the next sale at the latest; never waits for the network.
    void flushOutbox();
    return null;
  }

  /** Known to the phone at once, sent before the sale that uses it. */
  async function onCreateCustomer(values: {
    name: string;
    phone: string;
  }): Promise<
    { ok: true; customer: CustomerDto } | { ok: false; message: string }
  > {
    const name = values.name.trim();
    if (!name) return { ok: false, message: 'Donnez le nom du client.' };
    if (!navigator.onLine) return { ok: false, message: NO_NETWORK };
    const pendingOperationId = crypto.randomUUID();
    const customer = {
      id: pendingOperationId,
      name: name.slice(0, 120),
      phone: values.phone.trim().slice(0, 30),
      email: '',
      address: '',
      taxId: '',
      notes: '',
      creditLimit: null,
      balance: 0,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pendingOperationId,
    };
    try {
      await addLocalCustomer(snapshot.organizationId, customer);
    } catch (error) {
      console.error('Client non enregistré', error);
      return {
        ok: false,
        message: 'Le client n’a pas pu être gardé sur ce téléphone.',
      };
    }
    await reloadSnapshot();
    return { ok: true, customer };
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex min-h-[calc(4rem+env(safe-area-inset-top))] items-center gap-3 border-b border-line bg-surface px-4 pt-[env(safe-area-inset-top)] print:hidden">
        {/* No link out: the checkout is left on purpose only. */}
        <ShopMark version={snapshot.shop.logoVersion} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-lg font-extrabold">
            {snapshot.shop.name}
          </span>
          <span className="flex items-center gap-1 text-base font-semibold text-brand-ink">
            <ShoppingCart aria-hidden className="size-4" />
            Caisse
          </span>
        </span>
        <button
          type="button"
          onClick={() => void quit()}
          className={buttonClasses('secondary', 'shrink-0')}
        >
          <LogOut aria-hidden className="size-5" />
          <span>
            Quitter
            <span className="sr-only sm:not-sr-only"> la caisse</span>
          </span>
        </button>
        {confirmDialog}
      </header>
      <main
        id="contenu"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pt-4 pb-40 lg:pb-8"
      >
        {!state.fresh && (
          <Alert tone="warning">
            Données de ce téléphone du{' '}
            {new Intl.DateTimeFormat('fr', {
              dateStyle: 'short',
              timeStyle: 'short',
              timeZone: snapshot.shop.timeZone,
            }).format(new Date(snapshot.refreshedAt))}{' '}
            : les prix peuvent avoir changé depuis.
          </Alert>
        )}
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
                  <span className="flex flex-wrap gap-2">
                    {entry.operation && (
                      <button
                        type="button"
                        onClick={() =>
                          void retryRejected(entry.clientOperationId).then(
                            flushOutbox,
                          )
                        }
                        className={buttonClasses('secondary')}
                      >
                        <RotateCcw aria-hidden className="size-5" />
                        Renvoyer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void dismissRejected(entry.clientOperationId)
                      }
                      className={buttonClasses('secondary')}
                    >
                      J’ai compris
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p>
              Rien n’est perdu : la vente reste sur ce téléphone. Montrez ce
              message au propriétaire ou au gérant de la boutique ; connecté, il
              peut la renvoyer.
            </p>
          </section>
        )}
        {/* Selling or the sales of this phone, without leaving. */}
        <div
          role="group"
          aria-label="Caisse"
          className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-muted p-1 print:hidden"
        >
          {(
            [
              { key: 'sell', label: 'Vendre', icon: ShoppingCart },
              {
                key: 'sales',
                label: `Ventes (${tickets.length})`,
                icon: ReceiptText,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={!ticket && view === tab.key}
              onClick={() => {
                setTicket(null);
                setView(tab.key);
              }}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-base font-bold ${
                !ticket && view === tab.key
                  ? 'bg-surface text-brand-ink shadow-sm'
                  : 'text-ink-muted'
              }`}
            >
              <tab.icon aria-hidden className="size-5" />
              {tab.label}
            </button>
          ))}
        </div>
        {ticket && (
          <LocalTicketView
            ticket={ticket}
            sale={asSale(ticket)}
            shop={snapshot.shop}
            money={money}
            onNext={() => {
              backToSell.current = true;
              setView('sell');
              setTicket(null);
            }}
          />
        )}
        {!ticket && view === 'sales' && (
          <SalesView tickets={tickets} money={money} onOpen={setTicket} />
        )}
        {/* Hidden, never unmounted: a cart in progress survives a look at
            the sales or at a ticket. */}
        <div
          hidden={ticket !== null || view !== 'sell'}
          className="flex flex-col gap-4"
        >
          {/* Not shown: the products and the cart have their own
              headers. Kept for screen readers, and to take the focus
              back after a sale. */}
          <h1 ref={sellTitleRef} tabIndex={-1} className="sr-only">
            Vendre
          </h1>
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
        </div>
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
