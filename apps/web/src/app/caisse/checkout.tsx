'use client';

import {
  computeSaleTotals,
  formatAmount,
  MOBILE_MONEY_PROVIDERS,
  parseAmount,
  PAYMENT_METHODS,
  UNITS,
  type CreateSaleInput,
  type CustomerDto,
  type MobileMoneyProvider,
  type PaymentMethod,
  type ProductDto,
} from '@nagaw/shared';
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  HandCoins,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useId, useMemo, useState, useTransition } from 'react';
import { CONTROL } from '@/components/form-field';
import { ProductTile } from '@/components/catalog/product-tile';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { formatQuantity, STOCK_LEVEL_LABELS } from '@/lib/catalog/labels';
import { PAYMENT_LABELS, PROVIDER_LABELS } from '@/lib/sales/labels';

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  mobile_money: Smartphone,
  card: CreditCard,
  credit: HandCoins,
};

interface CartLine {
  productId: string;
  /** As typed (« 1,5 »), so that the field keeps what the seller types. */
  quantityText: string;
}

interface SplitRow {
  method: PaymentMethod;
  amountText: string;
  provider: MobileMoneyProvider | null;
}

const parseQuantity = (text: string): number => {
  const value = text.replace(/\s/g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(value) ? Number(value) : Number.NaN;
};
const quantityText = (value: number) => String(value).replace('.', ',');

function MethodButton({
  method,
  selected,
  onSelect,
}: {
  method: PaymentMethod;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = METHOD_ICONS[method];
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 text-base font-bold ${
        selected
          ? 'border-sales-strong bg-sales-strong text-white'
          : 'border-line-strong bg-surface text-ink'
      }`}
    >
      <Icon aria-hidden className="size-6" />
      {PAYMENT_LABELS[method]}
    </button>
  );
}

function ProviderPicker({
  value,
  onChange,
  label,
}: {
  value: MobileMoneyProvider | null;
  onChange: (provider: MobileMoneyProvider) => void;
  label: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-base font-semibold">{label}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MOBILE_MONEY_PROVIDERS.map((provider) => (
          <button
            key={provider}
            type="button"
            aria-pressed={value === provider}
            onClick={() => onChange(provider)}
            className={`min-h-12 rounded-xl border-2 px-3 text-base font-bold ${
              value === provider
                ? 'border-brand-strong bg-brand-strong text-white'
                : 'border-line-strong bg-surface text-ink'
            }`}
          >
            {PROVIDER_LABELS[provider]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** What the checkout hands over once the seller confirms the sale. */
export interface SaleDraft {
  customer: CustomerDto | null;
  lines: { product: ProductDto; quantity: number; lineTotal: number }[];
  totals: ReturnType<typeof computeSaleTotals>;
  payments: CreateSaleInput['payments'];
  cashReceived: number | null;
}

/**
 * The checkout screen (Phase 10). It knows nothing of the network: the
 * offline checkout (/caisse) records the sale on the device and sends it
 * when it can (ADR-020).
 */
export function Checkout({
  currency,
  products,
  customers: initialCustomers,
  onRecord,
  onCreateCustomer,
}: {
  currency: string;
  products: ProductDto[];
  customers: CustomerDto[];
  /** Resolves with an error message, or nothing once recorded. */
  onRecord: (draft: SaleDraft) => Promise<string | null>;
  onCreateCustomer: (values: {
    name: string;
    phone: string;
  }) => Promise<
    { ok: true; customer: CustomerDto } | { ok: false; message: string }
  >;
}) {
  const ids = useId();
  const money = (value: number) => formatAmount(value, currency);

  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [step, setStep] = useState<'cart' | 'pay'>('cart');
  const [discountText, setDiscountText] = useState('');
  const [method, setMethod] = useState<PaymentMethod | 'split'>('cash');
  const [provider, setProvider] = useState<MobileMoneyProvider | null>(null);
  const [reference, setReference] = useState('');
  const [cashText, setCashText] = useState('');
  const [split, setSplit] = useState<SplitRow[]>([
    { method: 'cash', amountText: '', provider: null },
    { method: 'mobile_money', amountText: '', provider: null },
  ]);
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState<{
    name: string;
    phone: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(text) || p.barcode === query.trim(),
    );
  }, [products, query]);

  const lines = cart.flatMap((line) => {
    const product = byId.get(line.productId);
    return product
      ? [{ product, quantity: parseQuantity(line.quantityText), line }]
      : [];
  });
  const linesValid = lines.every(
    ({ product, quantity }) =>
      quantity > 0 &&
      (UNITS[product.unit].decimals || Number.isInteger(quantity)),
  );
  const discount =
    discountText.trim() === '' ? 0 : parseAmount(discountText, currency);
  const totals = computeSaleTotals(
    lines.map(({ product, quantity }) => ({
      unitPrice: product.salePrice,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      taxRateBasisPoints: product.taxRate?.rateBasisPoints ?? null,
    })),
    discount ?? 0,
  );

  function add(product: ProductDto) {
    setError(null);
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (!existing)
        return [...current, { productId: product.id, quantityText: '1' }];
      const value = parseQuantity(existing.quantityText);
      return current.map((line) =>
        line === existing
          ? {
              ...line,
              quantityText: quantityText(
                (Number.isFinite(value) ? value : 0) + 1,
              ),
            }
          : line,
      );
    });
  }
  function adjust(productId: string, delta: number) {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.productId !== productId) return [line];
        const value = parseQuantity(line.quantityText);
        const next = (Number.isFinite(value) ? value : 0) + delta;
        return next <= 0
          ? []
          : [
              {
                ...line,
                quantityText: quantityText(Math.round(next * 1000) / 1000),
              },
            ];
      }),
    );
  }

  // Payments for the API, or an error message for the seller.
  function payments():
    | { payments: CreateSaleInput['payments']; cashReceived: number | null }
    | string {
    if (totals.total <= 0) return 'Il n’y a rien à payer.';
    if (method === 'split') {
      const rows = split.filter((row) => row.amountText.trim() !== '');
      const parsed = rows.map((row) => ({
        method: row.method,
        amount: parseAmount(row.amountText, currency),
        provider: row.method === 'mobile_money' ? row.provider : null,
        reference: null,
      }));
      if (parsed.some((p) => p.amount === null || p.amount === 0))
        return 'Vérifiez les montants des paiements.';
      if (parsed.some((p) => p.method === 'mobile_money' && !p.provider))
        return 'Choisissez l’opérateur Mobile Money.';
      const sum = parsed.reduce((s, p) => s + (p.amount ?? 0), 0);
      if (sum !== totals.total)
        return `Les paiements font ${money(sum)} au lieu de ${money(totals.total)}.`;
      return {
        payments: parsed.map((p) => ({ ...p, amount: p.amount ?? 0 })),
        cashReceived: null,
      };
    }
    if (method === 'mobile_money' && !provider)
      return 'Choisissez l’opérateur Mobile Money.';
    let cashReceived: number | null = null;
    if (method === 'cash' && cashText.trim() !== '') {
      cashReceived = parseAmount(cashText, currency);
      if (cashReceived === null) return 'Somme reçue illisible.';
      if (cashReceived < totals.total) return 'La somme reçue ne suffit pas.';
    }
    return {
      payments: [
        {
          method,
          amount: totals.total,
          provider: method === 'mobile_money' ? provider : null,
          reference:
            method === 'mobile_money' && reference.trim()
              ? reference.trim()
              : null,
        },
      ],
      cashReceived,
    };
  }

  const usesCredit =
    method === 'credit' ||
    (method === 'split' &&
      split.some((row) => row.method === 'credit' && row.amountText.trim()));
  const cashReceived =
    method === 'cash' ? parseAmount(cashText, currency) : null;
  const change =
    cashReceived !== null && cashReceived >= totals.total
      ? cashReceived - totals.total
      : null;

  function submit() {
    setError(null);
    if (!linesValid) return setError('Vérifiez les quantités du panier.');
    if (discount === null) return setError('Remise illisible.');
    const paid = payments();
    if (typeof paid === 'string') return setError(paid);
    if (usesCredit && !customerId)
      return setError('Choisissez le client qui paiera plus tard.');
    startTransition(async () => {
      const failure = await onRecord({
        customer: customers.find((c) => c.id === customerId) ?? null,
        lines: lines.map(({ product, quantity }, index) => ({
          product,
          quantity,
          lineTotal: totals.lines[index]?.lineTotal ?? 0,
        })),
        totals,
        payments: paid.payments,
        cashReceived: paid.cashReceived,
      });
      if (failure) {
        setError(failure);
        return;
      }
      // Ready for the next customer.
      setCart([]);
      setDiscountText('');
      setCashText('');
      setReference('');
      setCustomerId('');
      setMethod('cash');
      setStep('cart');
    });
  }

  function createCustomer() {
    if (!newCustomer) return;
    startTransition(async () => {
      const result = await onCreateCustomer(newCustomer);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCustomers((current) => [...current, result.customer]);
      setCustomerId(result.customer.id);
      setNewCustomer(null);
      setError(null);
    });
  }

  const cartPanel = (
    <section
      aria-labelledby={`${ids}-cart`}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm"
    >
      <h2
        id={`${ids}-cart`}
        className="flex items-center gap-2 text-xl font-bold"
      >
        <ShoppingCart aria-hidden className="size-6 text-sales-ink" />
        Panier
      </h2>
      {cart.length === 0 ? (
        <p className="text-ink-muted">Touchez un produit pour l’ajouter.</p>
      ) : (
        <ul
          aria-label="Articles du panier"
          className="flex flex-col divide-y divide-line"
        >
          {lines.map(({ product, quantity, line }, index) => {
            const inputId = `${ids}-qty-${product.id}`;
            return (
              <li
                key={product.id}
                className="flex flex-col gap-2 py-3 first:pt-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <label htmlFor={inputId} className="font-semibold">
                    {product.name}
                  </label>
                  <span className="font-bold tabular-nums">
                    {money(totals.lines[index]?.lineTotal ?? 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjust(product.id, -1)}
                    aria-label={`Un de moins : ${product.name}`}
                    className="flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-line-strong"
                  >
                    <Minus aria-hidden className="size-5" />
                  </button>
                  <input
                    id={inputId}
                    inputMode="decimal"
                    value={line.quantityText}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setCart((current) =>
                        current.map((l) =>
                          l.productId === product.id
                            ? { ...l, quantityText: value }
                            : l,
                        ),
                      );
                    }}
                    aria-invalid={!(quantity > 0) || undefined}
                    className={`${CONTROL.replace('w-full', 'w-24')} shrink-0 text-center text-lg font-bold`}
                  />
                  <button
                    type="button"
                    onClick={() => adjust(product.id, 1)}
                    aria-label={`Un de plus : ${product.name}`}
                    className="flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-line-strong"
                  >
                    <Plus aria-hidden className="size-5" />
                  </button>
                  <span className="text-ink-muted">
                    {UNITS[product.unit].label}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCart((current) =>
                        current.filter((l) => l.productId !== product.id),
                      )
                    }
                    aria-label={`Retirer ${product.name}`}
                    className="ml-auto flex size-12 items-center justify-center rounded-xl text-danger-ink hover:bg-danger-soft"
                  >
                    <Trash2 aria-hidden className="size-5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {cart.length > 0 && (
        <>
          <details className="rounded-xl bg-surface-muted p-3">
            <summary className="flex min-h-12 cursor-pointer items-center font-bold">
              Faire une remise
            </summary>
            <label
              htmlFor={`${ids}-discount`}
              className="mt-2 block font-semibold"
            >
              Remise sur la vente
            </label>
            <input
              id={`${ids}-discount`}
              inputMode="decimal"
              value={discountText}
              onChange={(event) => setDiscountText(event.currentTarget.value)}
              aria-invalid={discount === null || undefined}
              className={`${CONTROL} mt-1`}
            />
          </details>
          <div className="flex items-end justify-between gap-2 border-t border-line pt-3">
            <span className="text-lg font-semibold">À payer</span>
            <span
              className="text-3xl font-extrabold tabular-nums text-sales-ink"
              aria-live="polite"
            >
              {money(totals.total)}
            </span>
          </div>
          {totals.discount > 0 && (
            <p className="text-ink-muted">
              Dont remise de {money(totals.discount)} sur{' '}
              {money(totals.subtotal)}.
            </p>
          )}
        </>
      )}
    </section>
  );

  const paymentPanel = (
    <section
      aria-labelledby={`${ids}-pay`}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm"
    >
      <h2 id={`${ids}-pay`} className="text-xl font-bold">
        Paiement
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PAYMENT_METHODS.map((m) => (
          <MethodButton
            key={m}
            method={m}
            selected={method === m}
            onSelect={() => setMethod(m)}
          />
        ))}
      </div>
      <button
        type="button"
        aria-pressed={method === 'split'}
        onClick={() => setMethod('split')}
        className={`min-h-12 rounded-xl border-2 px-3 text-base font-bold ${
          method === 'split'
            ? 'border-sales-strong bg-sales-soft text-sales-ink'
            : 'border-line-strong'
        }`}
      >
        Payer avec plusieurs moyens
      </button>

      {method === 'cash' && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${ids}-cash`} className="font-semibold">
            Somme reçue du client (facultatif)
          </label>
          <input
            id={`${ids}-cash`}
            inputMode="decimal"
            value={cashText}
            onChange={(event) => setCashText(event.currentTarget.value)}
            className={CONTROL}
          />
          {change !== null && (
            <p
              className="rounded-xl bg-sales-soft p-3 text-2xl font-extrabold text-sales-ink"
              aria-live="polite"
            >
              À rendre : {money(change)}
            </p>
          )}
        </div>
      )}
      {method === 'mobile_money' && (
        <>
          <ProviderPicker
            value={provider}
            onChange={setProvider}
            label="Opérateur"
          />
          <div className="flex flex-col gap-1">
            <label htmlFor={`${ids}-ref`} className="font-semibold">
              Numéro de transaction (facultatif)
            </label>
            <input
              id={`${ids}-ref`}
              value={reference}
              maxLength={60}
              onChange={(event) => setReference(event.currentTarget.value)}
              className={CONTROL}
            />
          </div>
        </>
      )}
      {method === 'split' && (
        <ul aria-label="Paiements" className="flex flex-col gap-3">
          {split.map((row, index) => (
            <li
              key={index}
              className="flex flex-col gap-2 rounded-xl bg-surface-muted p-3"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  aria-label={`Moyen du paiement ${index + 1}`}
                  value={row.method}
                  onChange={(event) => {
                    const value = event.currentTarget.value as PaymentMethod;
                    setSplit((rows) =>
                      rows.map((r, i) =>
                        i === index ? { ...r, method: value } : r,
                      ),
                    );
                  }}
                  className={CONTROL}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_LABELS[m]}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Montant du paiement ${index + 1}`}
                  inputMode="decimal"
                  value={row.amountText}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setSplit((rows) =>
                      rows.map((r, i) =>
                        i === index ? { ...r, amountText: value } : r,
                      ),
                    );
                  }}
                  className={CONTROL}
                />
              </div>
              {row.method === 'mobile_money' && (
                <ProviderPicker
                  value={row.provider}
                  label={`Opérateur du paiement ${index + 1}`}
                  onChange={(value) =>
                    setSplit((rows) =>
                      rows.map((r, i) =>
                        i === index ? { ...r, provider: value } : r,
                      ),
                    )
                  }
                />
              )}
            </li>
          ))}
          {split.length < 5 && (
            <li>
              <button
                type="button"
                onClick={() =>
                  setSplit((rows) => [
                    ...rows,
                    { method: 'card', amountText: '', provider: null },
                  ])
                }
                className={buttonClasses('secondary')}
              >
                <Plus aria-hidden className="size-5" />
                Ajouter un paiement
              </button>
            </li>
          )}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor={`${ids}-customer`} className="font-semibold">
          {usesCredit ? 'Client qui paiera plus tard' : 'Client (facultatif)'}
        </label>
        <select
          id={`${ids}-customer`}
          value={customerId}
          onChange={(event) => setCustomerId(event.currentTarget.value)}
          className={CONTROL}
        >
          <option value="">
            {usesCredit ? 'Choisissez un client' : 'Client de passage'}
          </option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
              {customer.phone ? ` — ${customer.phone}` : ''}
              {customer.balance > 0 ? ` (doit ${money(customer.balance)})` : ''}
            </option>
          ))}
        </select>
        {newCustomer ? (
          <div className="flex flex-col gap-2 rounded-xl bg-surface-muted p-3">
            <label htmlFor={`${ids}-new-name`} className="font-semibold">
              Nom du nouveau client
            </label>
            <input
              id={`${ids}-new-name`}
              value={newCustomer.name}
              maxLength={120}
              onChange={(event) =>
                setNewCustomer({
                  ...newCustomer,
                  name: event.currentTarget.value,
                })
              }
              className={CONTROL}
            />
            <label htmlFor={`${ids}-new-phone`} className="font-semibold">
              Téléphone (facultatif)
            </label>
            <input
              id={`${ids}-new-phone`}
              type="tel"
              inputMode="tel"
              value={newCustomer.phone}
              maxLength={30}
              onChange={(event) =>
                setNewCustomer({
                  ...newCustomer,
                  phone: event.currentTarget.value,
                })
              }
              className={CONTROL}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={createCustomer}
                disabled={pending}
                className={buttonClasses('primary')}
              >
                Ajouter le client
              </button>
              <button
                type="button"
                onClick={() => setNewCustomer(null)}
                className={buttonClasses('secondary')}
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNewCustomer({ name: '', phone: '' })}
            className="inline-flex min-h-12 items-center gap-2 self-start font-bold text-brand-ink underline underline-offset-4"
          >
            <Plus aria-hidden className="size-5" />
            Nouveau client
          </button>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      <button
        type="button"
        onClick={submit}
        disabled={pending || cart.length === 0}
        className={buttonClasses('sell', 'min-h-16 w-full text-xl')}
      >
        {pending
          ? 'Enregistrement…'
          : `Valider la vente — ${money(totals.total)}`}
      </button>
    </section>
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_24rem]">
      <div
        className={`flex flex-col gap-4 ${step === 'pay' ? 'hidden lg:flex' : ''}`}
      >
        <div className="relative">
          <label htmlFor={`${ids}-search`} className="sr-only">
            Chercher un produit à vendre
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted"
          />
          <input
            id={`${ids}-search`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Chercher un produit"
            className={`${CONTROL} pl-12`}
          />
        </div>
        {visible.length === 0 ? (
          <p className="text-ink-muted">Aucun produit ne correspond.</p>
        ) : (
          <ul
            aria-label="Produits à vendre"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
          >
            {visible.map((product) => {
              const inCart = cart.find((line) => line.productId === product.id);
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => add(product)}
                    aria-label={`Ajouter ${product.name}, ${money(product.salePrice)}`}
                    className={`relative flex h-full min-h-40 w-full flex-col items-center gap-2 rounded-2xl border-2 bg-surface p-3 text-center shadow-sm ${
                      inCart
                        ? 'border-sales-strong'
                        : 'border-line hover:border-sales'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute top-2 right-2 rounded-full bg-sales-strong px-2.5 py-0.5 text-base font-extrabold text-white">
                        {inCart.quantityText}
                      </span>
                    )}
                    <ProductTile product={product} />
                    <span className="line-clamp-2 font-semibold">
                      {product.name}
                    </span>
                    <span className="text-lg font-extrabold tabular-nums text-sales-ink">
                      {money(product.salePrice)}
                    </span>
                    {product.stockLevel === 'out' && (
                      <span className="text-base text-danger-ink">
                        {STOCK_LEVEL_LABELS.out}
                      </span>
                    )}
                    {product.stockLevel === 'low' && (
                      <span className="text-base text-warning-ink">
                        Reste{' '}
                        {formatQuantity(product.stockQuantity, product.unit)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div
        className={`flex flex-col gap-4 ${step === 'cart' ? 'hidden lg:flex' : ''}`}
      >
        {step === 'pay' && (
          <button
            type="button"
            onClick={() => setStep('cart')}
            className={`${buttonClasses('secondary')} lg:hidden`}
          >
            <ArrowLeft aria-hidden className="size-5" />
            Ajouter d’autres produits
          </button>
        )}
        {cartPanel}
        {cart.length > 0 && paymentPanel}
      </div>

      {step === 'cart' && cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setStep('pay')}
            className={buttonClasses(
              'sell',
              'min-h-16 w-full text-lg shadow-lg',
            )}
          >
            <ShoppingCart aria-hidden className="size-6" />
            Encaisser — {money(totals.total)}
          </button>
        </div>
      )}
    </div>
  );
}
