'use client';

import {
  displayPriceOf,
  formatAmount,
  MOBILE_MONEY_PROVIDERS,
  parseAmount,
  PAYMENT_METHODS,
  sellingOptionsOf,
  UNITS,
  type CreateSaleInput,
  type CustomerDto,
  type MobileMoneyProvider,
  type PaymentMethod,
  type ProductDto,
  type SellingOption,
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
  Tag,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { CONTROL } from '@/components/form-field';
import { ProductTile } from '@/components/catalog/product-tile';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { formatQuantity, STOCK_LEVEL_LABELS } from '@/lib/catalog/labels';
import { correctionProblem } from '@/lib/offline/local-stock';
import {
  lineKey,
  negotiationProblem,
  parseFrancs,
  parseQuantity,
  priceCart,
  quantityError,
  quantityForAmount,
  quantityText,
  totalsOf,
  wantedStock,
  type CartLine,
  type NegotiationRules,
  type PricedLine,
} from '@/lib/sales/cart';
import { PAYMENT_LABELS, PROVIDER_LABELS } from '@/lib/sales/labels';

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  mobile_money: Smartphone,
  card: CreditCard,
  credit: HandCoins,
};

interface SplitRow {
  method: PaymentMethod;
  amountText: string;
  provider: MobileMoneyProvider | null;
}

/** « kg », « Sac de 50 kg », « g ». */
const optionName = (product: ProductDto, option: SellingOption) =>
  option.label ?? UNITS[product.unit].label;

/** « 650 F le kg », « 30 000 F », « 0,65 F le g » shown as « 650 F le kg ». */
function optionPrice(
  product: ProductDto,
  option: SellingOption,
  money: (value: number) => string,
): string {
  if (option.price !== null) return money(option.price);
  // Priced by weight or length: the price of the stock unit says more
  // than a fraction of a franc.
  const one = displayPriceOf(option, product.salePrice);
  return option.factor < 1
    ? `${money(product.salePrice)} le ${UNITS[product.unit].label}`
    : money(one);
}

/**
 * Which unit to sell (ADR-038): « Kilo », « Gramme », « Sac de 50 kg ».
 * A native modal dialog: the focus stays inside, Escape closes it.
 */
function UnitPicker({
  product,
  money,
  onPick,
  onClose,
}: {
  product: ProductDto;
  money: (value: number) => string;
  onPick: (option: SellingOption) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 id={titleId} className="text-xl font-bold">
            {product.name} : vendre en…
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Fermer"
            className="flex size-12 shrink-0 items-center justify-center rounded-xl hover:bg-surface-muted"
          >
            <X aria-hidden className="size-6" />
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {sellingOptionsOf(product).map((option) => (
            <li key={option.key}>
              <button
                type="button"
                onClick={() => {
                  onPick(option);
                  ref.current?.close();
                }}
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border-2 border-line-strong bg-surface px-4 text-left text-lg font-bold hover:border-sales"
              >
                <span>{optionName(product, option)}</span>
                <span className="tabular-nums text-sales-ink">
                  {optionPrice(product, option, money)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}

/**
 * The price agreed with the customer for one line (ADR-038): typed as the
 * amount of the line, or as « for this amount » when the unit takes
 * decimals (the quantity is then worked out).
 */
function PriceEditor({
  priced,
  listTotal,
  money,
  onAgree,
  onAmount,
}: {
  priced: PricedLine;
  listTotal: number;
  money: (value: number) => string;
  onAgree: (agreedText: string) => void;
  onAmount: (quantity: number, amount: number) => void;
}) {
  const ids = useId();
  const [text, setText] = useState(priced.line.agreedText);
  const [problem, setProblem] = useState<string | null>(null);
  const forAmount = priced.option.allowsDecimals;

  function read(): number | null {
    const amount = parseFrancs(text);
    if (!Number.isFinite(amount) || amount <= 0) {
      setProblem('Tapez un montant en chiffres, par exemple 28000.');
      return null;
    }
    setProblem(null);
    return amount;
  }

  return (
    <details
      open={priced.agreedTotal !== null || undefined}
      className="rounded-xl bg-surface-muted p-3"
    >
      <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-bold">
        <Tag aria-hidden className="size-5" />
        Changer le prix
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <label htmlFor={`${ids}-amount`} className="font-semibold">
          Le client paie pour cette ligne (prix affiché : {money(listTotal)})
        </label>
        <input
          id={`${ids}-amount`}
          inputMode="numeric"
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${ids}-problem` : undefined}
          className={CONTROL}
        />
        {problem && (
          <p id={`${ids}-problem`} className="font-medium text-danger-ink">
            {problem}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const amount = read();
              if (amount !== null) onAgree(String(amount));
            }}
            className={buttonClasses('primary')}
          >
            Appliquer ce prix
          </button>
          {forAmount && (
            <button
              type="button"
              onClick={() => {
                const amount = read();
                if (amount === null) return;
                const quantity = quantityForAmount(
                  priced.option,
                  priced.product.salePrice,
                  amount,
                );
                if (quantity === null)
                  return setProblem('Montant trop petit pour cette unité.');
                onAmount(quantity, amount);
              }}
              className={buttonClasses('secondary')}
            >
              Servir pour ce montant
            </button>
          )}
          {priced.agreedTotal !== null && (
            <button
              type="button"
              onClick={() => {
                setText('');
                setProblem(null);
                onAgree('');
              }}
              className={buttonClasses('secondary')}
            >
              Remettre le prix affiché
            </button>
          )}
        </div>
        {forAmount && (
          <p className="text-ink-muted">
            « Servir pour ce montant » calcule la quantité à peser ou à mesurer.
          </p>
        )}
      </div>
    </details>
  );
}

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

/** What the seller may do about the stock at the counter (ADR-036). */
export interface StockRights {
  canCorrect: boolean;
  /** Owner or manager: not limited by the shop's correction cap. */
  manager: boolean;
  /** Largest change a seller may make (0: none). */
  max: number;
}

/**
 * Shown under a cart line that asks for more than the recorded stock: the
 * seller is warned and, when allowed, corrects the stock with what is
 * really on the shelf before selling.
 */
function StockWarning({
  product,
  wanted,
  rights,
  onCorrect,
}: {
  product: ProductDto;
  wanted: number;
  rights: StockRights;
  onCorrect: (counted: number, reason: string) => Promise<string | null>;
}) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [countedText, setCountedText] = useState('');
  const [reason, setReason] = useState('Recompté en rayon');
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const known = Math.max(product.stockQuantity, 0);

  function save() {
    const counted = parseQuantity(countedText);
    if (!(counted >= 0))
      return setProblem('Tapez le nombre compté, par exemple 12.');
    if (!UNITS[product.unit].decimals && !Number.isInteger(counted))
      return setProblem('Tapez un nombre entier, sans virgule.');
    if (!reason.trim()) return setProblem('Dites pourquoi le stock change.');
    const refused = correctionProblem(
      Math.round((counted - product.stockQuantity) * 1000) / 1000,
      rights,
    );
    if (refused) return setProblem(refused);
    setProblem(null);
    startTransition(async () => {
      const failure = await onCorrect(counted, reason.trim().slice(0, 500));
      if (failure) setProblem(failure);
      else setOpen(false);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border-l-4 border-warning bg-warning-soft p-3 text-warning-ink">
      <p className="font-semibold">
        Stock insuffisant : {formatQuantity(wanted, product.unit)} dans le
        panier, {formatQuantity(known, product.unit)} en stock.
      </p>
      {!rights.canCorrect ? (
        <p>La vente sera signalée au gérant.</p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => {
            setCountedText('');
            setOpen(true);
          }}
          className={`${buttonClasses('secondary')} self-start`}
        >
          Corriger le stock
        </button>
      ) : (
        <div className="flex flex-col gap-2 text-ink">
          <label htmlFor={`${ids}-counted`} className="font-semibold">
            Combien y en a-t-il vraiment en rayon ? ({UNITS[product.unit].label}
            )
          </label>
          <input
            id={`${ids}-counted`}
            inputMode="decimal"
            value={countedText}
            onChange={(event) => setCountedText(event.currentTarget.value)}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? `${ids}-problem` : undefined}
            className={CONTROL}
          />
          <label htmlFor={`${ids}-reason`} className="font-semibold">
            Pourquoi ?
          </label>
          <input
            id={`${ids}-reason`}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.currentTarget.value)}
            className={CONTROL}
          />
          {problem && (
            <p id={`${ids}-problem`} className="font-medium text-danger-ink">
              {problem}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className={buttonClasses('primary')}
            >
              {pending ? 'Enregistrement…' : 'Enregistrer le stock'}
            </button>
            <button
              type="button"
              onClick={() => {
                setProblem(null);
                setOpen(false);
              }}
              className={buttonClasses('secondary')}
            >
              Annuler
            </button>
          </div>
          <p className="text-ink-muted">
            Le gérant est prévenu de chaque correction.
          </p>
        </div>
      )}
    </div>
  );
}

/** What the checkout hands over once the seller confirms the sale. */
export interface SaleDraft {
  customer: CustomerDto | null;
  lines: (PricedLine & { lineTotal: number; listTotal: number })[];
  totals: ReturnType<typeof totalsOf>;
  payments: CreateSaleInput['payments'];
  cashReceived: number | null;
}

/**
 * The checkout screen (Phase 10). It knows nothing of the network: the
 * checkout (/caisse) sends the sale to the server (ADR-042) and shows
 * its answer.
 */
export function Checkout({
  currency,
  products,
  customers: initialCustomers,
  stockRights,
  negotiation,
  onRecord,
  onCreateCustomer,
  onCorrectStock,
}: {
  currency: string;
  products: ProductDto[];
  customers: CustomerDto[];
  stockRights: StockRights;
  negotiation: NegotiationRules;
  /** Resolves with an error message, or nothing once recorded. */
  onCorrectStock: (
    product: ProductDto,
    counted: number,
    reason: string,
  ) => Promise<string | null>;
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
  // The product whose unit is being chosen (ADR-038).
  const [choosing, setChoosing] = useState<ProductDto | null>(null);
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
  // Spoken after each tap on a product: on phones the cart is out of view.
  const [announcement, setAnnouncement] = useState('');
  // Where the focus goes once the step has changed: the button that was
  // pressed disappears with it (WCAG 2.4.3).
  const cartTitleRef = useRef<HTMLHeadingElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const focusAfterStep = useRef(false);
  useEffect(() => {
    if (!focusAfterStep.current) return;
    focusAfterStep.current = false;
    (step === 'pay' ? cartTitleRef : searchRef).current?.focus();
  }, [step]);
  function goTo(next: 'cart' | 'pay') {
    focusAfterStep.current = true;
    setStep(next);
  }

  const byId = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(text) ||
        p.barcode === query.trim() ||
        p.units.some((u) => u.barcode === query.trim()),
    );
  }, [products, query]);

  const lines = priceCart(cart, byId);
  const linesValid = lines.every(
    ({ option, quantity }) => quantityError(option, quantity) === null,
  );
  // Stock asked per product, all units together (« 1 sac + 3 kg »).
  const wanted = wantedStock(lines);
  const shortages = [...wanted].flatMap(([productId, quantity]) => {
    const product = byId.get(productId);
    return product?.trackStock && quantity > product.stockQuantity
      ? [{ product, wanted: quantity }]
      : [];
  });
  const discount =
    discountText.trim() === '' ? 0 : parseAmount(discountText, currency);
  const totals = totalsOf(lines, discount ?? 0);
  const agreedInvalid = cart.some(
    (line) =>
      line.agreedText.trim() !== '' &&
      !Number.isFinite(parseFrancs(line.agreedText)),
  );
  const refusal = negotiationProblem(lines, totals, negotiation, currency);

  function updateLine(key: string, change: Partial<CartLine>) {
    setCart((current) =>
      current.map((l) => (lineKey(l) === key ? { ...l, ...change } : l)),
    );
  }

  function add(product: ProductDto, option: SellingOption) {
    setError(null);
    const key = lineKey({ productId: product.id, optionKey: option.key });
    const existing = cart.find((line) => lineKey(line) === key);
    const before = existing ? parseQuantity(existing.quantityText) : 0;
    const count = (Number.isFinite(before) ? before : 0) + 1;
    const unitName = optionName(product, option);
    setAnnouncement(
      `${product.name} ajouté. ${quantityText(count)}${option.key === 'stock' ? '' : ` ${unitName}`} dans le panier.` +
        (product.trackStock &&
        (wanted.get(product.id) ?? 0) + option.factor > product.stockQuantity
          ? ' Attention : stock insuffisant.'
          : ''),
    );
    setCart((current) => {
      const found = current.find((line) => lineKey(line) === key);
      if (!found)
        return [
          ...current,
          {
            productId: product.id,
            optionKey: option.key,
            quantityText: '1',
            agreedText: '',
          },
        ];
      const value = parseQuantity(found.quantityText);
      return current.map((line) =>
        line === found
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
  /** One tap: the only unit at once, otherwise the choice of the unit. */
  function tap(product: ProductDto) {
    const options = sellingOptionsOf(product);
    if (options.length === 1) add(product, options[0]!);
    else setChoosing(product);
  }
  function adjust(key: string, delta: number) {
    setCart((current) =>
      current.flatMap((line) => {
        if (lineKey(line) !== key) return [line];
        const value = parseQuantity(line.quantityText);
        const next = (Number.isFinite(value) ? value : 0) + delta;
        return next <= 0 ? [] : [{ ...line, quantityText: quantityText(next) }];
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
    if (agreedInvalid) return setError('Vérifiez les prix changés du panier.');
    if (discount === null) return setError('Remise illisible.');
    if (refusal) return setError(refusal);
    const paid = payments();
    if (typeof paid === 'string') return setError(paid);
    if (usesCredit && !customerId)
      return setError('Choisissez le client qui paiera plus tard.');
    startTransition(async () => {
      const failure = await onRecord({
        customer: customers.find((c) => c.id === customerId) ?? null,
        lines: lines.map((priced, index) => ({
          ...priced,
          lineTotal: totals.lines[index]?.lineTotal ?? 0,
          listTotal: totals.lines[index]?.listTotal ?? 0,
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
        ref={cartTitleRef}
        tabIndex={-1}
        className="flex items-center gap-2 text-xl font-bold focus:outline-none"
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
          {lines.map((priced, index) => {
            const { product, option, quantity, line } = priced;
            const key = lineKey(line);
            const inputId = `${ids}-qty-${key}`;
            const invalid = quantityError(option, quantity);
            const unitName = optionName(product, option);
            const computed = totals.lines[index];
            const negotiated =
              computed !== undefined &&
              priced.agreedTotal !== null &&
              computed.lineTotal !== computed.listTotal;
            // The stock warning goes under the first line of the product.
            const firstOfProduct =
              lines.findIndex((l) => l.product.id === product.id) === index;
            const shortage = shortages.find((s) => s.product.id === product.id);
            return (
              <li key={key} className="flex flex-col gap-2 py-3 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <label htmlFor={inputId} className="font-semibold">
                    {product.name}
                    {option.key !== 'stock' && (
                      <span className="block font-normal text-ink-muted">
                        en {unitName}
                      </span>
                    )}
                  </label>
                  <span className="text-right font-bold tabular-nums">
                    {negotiated && (
                      <s className="block font-normal text-ink-muted">
                        {money(computed.listTotal)}
                      </s>
                    )}
                    {money(computed?.lineTotal ?? 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjust(key, -1)}
                    aria-label={`Un de moins : ${product.name}, ${unitName}`}
                    className="flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-line-strong"
                  >
                    <Minus aria-hidden className="size-5" />
                  </button>
                  <input
                    id={inputId}
                    inputMode="decimal"
                    value={line.quantityText}
                    onChange={(event) =>
                      updateLine(key, {
                        quantityText: event.currentTarget.value,
                      })
                    }
                    aria-invalid={invalid ? true : undefined}
                    aria-describedby={invalid ? `${inputId}-error` : undefined}
                    className={`${CONTROL.replace('w-full', 'w-24')} shrink-0 text-center text-lg font-bold`}
                  />
                  <button
                    type="button"
                    onClick={() => adjust(key, 1)}
                    aria-label={`Un de plus : ${product.name}, ${unitName}`}
                    className="flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-line-strong"
                  >
                    <Plus aria-hidden className="size-5" />
                  </button>
                  <span className="text-ink-muted">{unitName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAnnouncement(`${product.name} retiré du panier.`);
                      setCart((current) =>
                        current.filter((l) => lineKey(l) !== key),
                      );
                    }}
                    aria-label={`Retirer ${product.name}, ${unitName}`}
                    className="ml-auto flex size-12 items-center justify-center rounded-xl text-danger-ink hover:bg-danger-soft"
                  >
                    <Trash2 aria-hidden className="size-5" />
                  </button>
                </div>
                {invalid && (
                  <p
                    id={`${inputId}-error`}
                    className="font-medium text-danger-ink"
                  >
                    {invalid}
                  </p>
                )}
                {!invalid && (
                  <PriceEditor
                    priced={priced}
                    listTotal={computed?.listTotal ?? 0}
                    money={money}
                    onAgree={(agreedText) => updateLine(key, { agreedText })}
                    onAmount={(next, amount) =>
                      updateLine(key, {
                        quantityText: quantityText(next),
                        agreedText: String(amount),
                      })
                    }
                  />
                )}
                {firstOfProduct && shortage && (
                  <StockWarning
                    product={product}
                    wanted={shortage.wanted}
                    rights={stockRights}
                    onCorrect={(counted, reason) =>
                      onCorrectStock(product, counted, reason)
                    }
                  />
                )}
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
              aria-describedby={
                discount === null ? `${ids}-discount-error` : undefined
              }
              className={`${CONTROL} mt-1`}
            />
            {discount === null && (
              <p
                id={`${ids}-discount-error`}
                className="mt-1 font-medium text-danger-ink"
              >
                Tapez un montant en chiffres, par exemple 500.
              </p>
            )}
          </details>
          <div className="flex items-end justify-between gap-2 border-t border-line pt-3">
            <span className="text-lg font-semibold">À payer</span>
            <span className="text-3xl font-extrabold tabular-nums text-sales-ink">
              {money(totals.total)}
            </span>
          </div>
          {totals.discount > 0 && (
            <p className="text-ink-muted">
              Dont remise de {money(totals.discount)} sur{' '}
              {money(totals.subtotal)}.
            </p>
          )}
          {totals.listSubtotal > totals.total && (
            <p className="text-ink-muted">
              Prix affichés : {money(totals.listSubtotal)}, soit{' '}
              {money(totals.listSubtotal - totals.total)} de réduction.
            </p>
          )}
          {refusal && <Alert tone="error">{refusal}</Alert>}
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
          {/* Present before it fills, so that screen readers speak it. */}
          <div aria-live="polite">
            {change !== null && (
              <p className="rounded-xl bg-sales-soft p-3 text-2xl font-extrabold text-sales-ink">
                À rendre : {money(change)}
              </p>
            )}
          </div>
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
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`${ids}-split-${index}-method`}
                    className="font-semibold"
                  >
                    Moyen du paiement {index + 1}
                  </label>
                  <select
                    id={`${ids}-split-${index}-method`}
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
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`${ids}-split-${index}-amount`}
                    className="font-semibold"
                  >
                    Montant du paiement {index + 1}
                  </label>
                  <input
                    id={`${ids}-split-${index}-amount`}
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

      {shortages.length > 0 && (
        <Alert tone="warning">
          {shortages.length > 1
            ? `${shortages.length} articles dépassent le stock enregistré.`
            : `« ${shortages[0]!.product.name} » dépasse le stock enregistré.`}{' '}
          {stockRights.canCorrect
            ? 'Corrigez le stock dans le panier si le rayon en a plus ; sinon la vente sera signalée au gérant.'
            : 'La vente sera signalée au gérant.'}
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <button
        type="button"
        onClick={submit}
        disabled={pending || cart.length === 0 || refusal !== null}
        className={buttonClasses('sell', 'min-h-16 w-full text-xl')}
      >
        {pending
          ? 'Enregistrement…'
          : shortages.length > 0
            ? `Vendre quand même — ${money(totals.total)}`
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
            ref={searchRef}
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
              const inCart = cart.filter(
                (line) => line.productId === product.id,
              );
              const several = sellingOptionsOf(product).length > 1;
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => tap(product)}
                    className={`relative flex h-full min-h-40 w-full flex-col items-center gap-2 rounded-2xl border-2 bg-surface p-3 text-center shadow-sm ${
                      inCart.length > 0
                        ? 'border-sales-strong'
                        : 'border-line hover:border-sales'
                    }`}
                  >
                    {/* No aria-label: the stock and the cart are read too. */}
                    <span className="sr-only">Ajouter </span>
                    <ProductTile product={product} />
                    <span className="line-clamp-2 font-semibold">
                      {product.name}
                    </span>
                    <span className="text-lg font-extrabold tabular-nums text-sales-ink">
                      {money(product.salePrice)}
                      {several && (
                        <span className="block text-base font-semibold text-ink-muted">
                          le {UNITS[product.unit].label} · autres unités
                        </span>
                      )}
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
                    {inCart.length > 0 && (
                      <span className="absolute top-2 right-2 rounded-full bg-sales-strong px-2.5 py-0.5 text-base font-extrabold text-white">
                        <span className="sr-only">, </span>
                        {inCart.length === 1
                          ? inCart[0]!.quantityText
                          : `${inCart.length} lignes`}
                        <span className="sr-only"> dans le panier</span>
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
            onClick={() => goTo('cart')}
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
            onClick={() => goTo('pay')}
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
      {choosing && (
        <UnitPicker
          product={choosing}
          money={money}
          onPick={(option) => add(choosing, option)}
          onClose={() => setChoosing(null)}
        />
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
