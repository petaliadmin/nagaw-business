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
import { ArrowLeft, ShoppingCart, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import {
  dismissRejected,
  flushOutbox,
  outboxStatus,
  OUTBOX_EVENT,
  readSnapshot,
  readTicket,
  recordLocally,
  addLocalCustomer,
  correctStockLocally,
  saveSnapshot,
  type LocalTicket,
  type RejectedEntry,
  type ShopSnapshot,
} from '@/lib/offline/store';
import { Checkout, type SaleDraft } from './checkout';
import { LocalTicketView } from './local-ticket';

type State =
  | { status: 'loading' }
  | { status: 'never-online' }
  | { status: 'signed-out' }
  | { status: 'not-allowed' }
  | { status: 'ready'; snapshot: ShopSnapshot; fresh: boolean };

interface ServerData {
  organizationId: string;
  shop: ShopSnapshot['shop'];
  products: ProductDto[];
  customers: CustomerDto[];
  devices: DeviceDto[];
  rules: { stockCorrectionMax: number };
}

function deviceLabel(): string {
  const date = new Intl.DateTimeFormat('fr', { dateStyle: 'short' }).format(
    new Date(),
  );
  return `Appareil enregistré le ${date}`;
}

/** Fresh data from the server, with this browser's device (registered once). */
async function refresh(
  previous: ShopSnapshot | null,
): Promise<
  | { ok: true; snapshot: ShopSnapshot }
  | { ok: false; reason: 'offline' | 'signed-out' | 'not-allowed' }
> {
  let response: Response;
  try {
    response = await fetch('/caisse/donnees', { cache: 'no-store' });
  } catch (error) {
    console.info('Caisse hors ligne : données locales', error);
    return { ok: false, reason: 'offline' };
  }
  if (response.status === 401) return { ok: false, reason: 'signed-out' };
  if (response.status === 403) return { ok: false, reason: 'not-allowed' };
  if (!response.ok) return { ok: false, reason: 'offline' };
  const data = (await response.json()) as ServerData;

  let device =
    previous?.organizationId === data.organizationId && previous.device
      ? (data.devices.find((d) => d.id === previous.device?.id) ?? null)
      : null;
  if (!device) {
    const registered = await fetch('/caisse/appareil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: data.organizationId,
        label: deviceLabel(),
        clientOperationId: crypto.randomUUID(),
      }),
    });
    if (registered.status === 403) return { ok: false, reason: 'not-allowed' };
    if (!registered.ok) return { ok: false, reason: 'offline' };
    device = (await registered.json()) as DeviceDto;
  }
  const snapshot = await saveSnapshot({
    organizationId: data.organizationId,
    shop: data.shop,
    products: data.products,
    customers: data.customers,
    device: { id: device.id, ticketPrefix: device.ticketPrefix },
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
      unitPrice: line.unitPrice,
      quantity: line.quantity,
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
            .reduce((s, p) => s + p.amount, 0),
    occurredAt: ticket.sale.occurredAt,
    deviceTicket: ticket.deviceTicket,
    priceReview: false,
    stockReview: false,
    cancellation: null,
  };
}

export function CaisseApp() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [ticket, setTicket] = useState<LocalTicket | null>(null);
  const [rejected, setRejected] = useState<RejectedEntry[]>([]);

  const loadRejected = useCallback(async (organizationId: string) => {
    const status = await outboxStatus();
    setRejected(
      status.rejected.filter((r) => r.organizationId === organizationId),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await readSnapshot();
      if (cached && !cancelled)
        setState({ status: 'ready', snapshot: cached, fresh: false });
      const fresh = await refresh(cached);
      if (cancelled) return;
      if (fresh.ok) {
        setState({ status: 'ready', snapshot: fresh.snapshot, fresh: true });
        void flushOutbox();
        await loadRejected(fresh.snapshot.organizationId);
      } else if (!cached) {
        setState({
          status:
            fresh.reason === 'signed-out'
              ? 'signed-out'
              : fresh.reason === 'not-allowed'
                ? 'not-allowed'
                : 'never-online',
        });
      } else {
        await loadRejected(cached.organizationId);
      }
    })().catch((error: unknown) => {
      console.error('Ouverture de la caisse impossible', error);
      if (!cancelled) setState({ status: 'never-online' });
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
  if (state.status === 'never-online')
    return (
      <Centered>
        <Alert tone="warning">
          Ouvrez la caisse une première fois avec internet : elle garde ensuite
          vos produits sur ce téléphone pour vendre sans connexion.
        </Alert>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={buttonClasses('primary')}
        >
          Réessayer
        </button>
      </Centered>
    );

  const { snapshot } = state;
  const money = (value: number) => formatAmount(value, snapshot.shop.currency);

  async function onRecord(draft: SaleDraft): Promise<string | null> {
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
            customerId: pendingCustomer ? null : (draft.customer?.id ?? null),
            customerOperationId: pendingCustomer?.pendingOperationId ?? null,
            lines: draft.lines.map(({ product, quantity }) => ({
              productId: product.id,
              quantity,
              unitPrice: product.salePrice,
            })),
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
              lines: draft.lines.map(({ product, quantity, lineTotal }) => ({
                label: product.name,
                unit: product.unit,
                quantity,
                unitPrice: product.salePrice,
                lineTotal,
              })),
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
      return 'La vente n’a pas pu être enregistrée sur ce téléphone. Rechargez la caisse avec internet.';
    }
    // Sent at once when the network allows; otherwise it waits safely.
    if ((await flushOutbox()) === 'sent') {
      const sent = await readTicket(clientOperationId);
      if (sent?.status === 'sent' && sent.saleId) {
        router.push(`/espace/ventes/${sent.saleId}?nouvelle=1`);
        return null;
      }
      if (sent) local = sent;
    }
    setTicket(local);
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

  async function onCorrectStock(
    product: ProductDto,
    counted: number,
    reason: string,
  ): Promise<string | null> {
    try {
      const updated = await correctStockLocally(snapshot.organizationId, {
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
      setState((current) =>
        current.status === 'ready'
          ? { ...current, snapshot: updated }
          : current,
      );
    } catch (error) {
      console.error('Correction de stock non enregistrée', error);
      return 'La correction n’a pas pu être enregistrée sur ce téléphone. Rechargez la caisse avec internet.';
    }
    // Sent with the next sale at the latest; never waits for the network.
    void flushOutbox();
    return null;
  }

  async function onCreateCustomer(values: { name: string; phone: string }) {
    const name = values.name.trim();
    if (!name)
      return { ok: false as const, message: 'Donnez le nom du client.' };
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
    await addLocalCustomer(snapshot.organizationId, customer);
    setState({
      ...state,
      snapshot: { ...snapshot, customers: [...snapshot.customers, customer] },
    } as State);
    return { ok: true as const, customer };
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-line bg-surface px-4 print:hidden">
        <Link
          href="/espace"
          className="flex min-h-12 items-center gap-2 rounded-xl px-2 font-bold text-brand-ink"
        >
          <ArrowLeft aria-hidden className="size-6" />
          Accueil
        </Link>
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
        {ticket ? (
          <LocalTicketView
            ticket={ticket}
            sale={asSale(ticket)}
            shop={snapshot.shop}
            money={money}
            onNext={() => {
              backToSell.current = true;
              setTicket(null);
            }}
          />
        ) : (
          <>
            <h1
              ref={sellTitleRef}
              tabIndex={-1}
              className="text-2xl font-extrabold focus:outline-none md:text-3xl"
            >
              Vendre
            </h1>
            <Checkout
              currency={snapshot.shop.currency}
              products={snapshot.products}
              customers={snapshot.customers}
              stockRights={stockRights}
              onRecord={onRecord}
              onCreateCustomer={onCreateCustomer}
              onCorrectStock={onCorrectStock}
            />
          </>
        )}
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
