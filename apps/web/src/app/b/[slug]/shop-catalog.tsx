'use client';

import {
  formatAmount,
  UNITS,
  type PublicCatalogDto,
  type PublicOrderReceiptDto,
  type PublicProductDto,
} from '@nagaw/shared';
import { CircleCheck, MessageCircle, Minus, Package, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import { FormField } from '@/components/form-field';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { buttonClasses } from '@/components/ui/button-styles';
import { whatsappLink } from '@/lib/sales/ticket';
import { placeOrder } from './actions';
import { WavePayButton } from './wave-pay-button';

/**
 * The public page of a shop (ADR-063): pick, send, then pay with the
 * reference. One main action at a time: « Commander », then « Envoyer ».
 */
export function ShopCatalog({ catalog }: { catalog: PublicCatalogDto }) {
  const { shop, products } = catalog;
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState<PublicOrderReceiptDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const money = (amount: number) => formatAmount(amount, shop.currency);

  const lines = useMemo(
    () =>
      products
        .filter((product) => (cart[product.id] ?? 0) > 0)
        .map((product) => ({ product, quantity: cart[product.id]! })),
    [products, cart],
  );
  const total = lines.reduce(
    (sum, { product, quantity }) => sum + product.price * quantity,
    0,
  );
  const count = lines.reduce((sum, { quantity }) => sum + quantity, 0);
  const setQuantity = (id: string, quantity: number) =>
    setCart((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(999, quantity)),
    }));

  const send = (formData: FormData) => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await placeOrder(shop.slug, {
        name: String(formData.get('name') ?? ''),
        phone: String(formData.get('phone') ?? ''),
        area: String(formData.get('area') ?? ''),
        note: String(formData.get('note') ?? ''),
        lines: lines.map(({ product, quantity }) => ({
          productId: product.id,
          quantity,
        })),
        expectedTotal: total,
      });
      if (result.ok) {
        setReceipt(result.receipt);
        setOpen(false);
        setCart({});
        return;
      }
      setError(result.message);
      setFieldErrors(result.fieldErrors ?? {});
      // New prices or stock: show them, the cart stays.
      if (result.priceChanged || result.fieldErrors?.lines) router.refresh();
    });
  };

  if (receipt) return <Receipt slug={shop.slug} receipt={receipt} />;

  return (
    <>
      <ShopHeader catalog={catalog} />

      {products.length === 0 ? (
        <Alert>Cette boutique n’a pas encore d’article en ligne.</Alert>
      ) : (
        <ul aria-label="Articles" className="flex flex-col gap-3">
          {products.map((product) => (
            <ProductRow
              key={product.id}
              slug={shop.slug}
              product={product}
              price={money(product.price)}
              quantity={cart[product.id] ?? 0}
              onChange={(quantity) => setQuantity(product.id, quantity)}
            />
          ))}
        </ul>
      )}

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgb(0_0_0/0.08)]">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <p className="flex-1 text-base">
              <span className="font-bold">{money(total)}</span>
              <span className="block text-ink-muted">
                {count} article{count > 1 ? 's' : ''}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={buttonClasses('sell', 'min-w-40')}
            >
              Commander
            </button>
          </div>
        </div>
      )}

      <BottomSheet
        open={open}
        title="Votre commande"
        onClose={() => setOpen(false)}
      >
        <ul className="mb-4 flex flex-col gap-1 text-base">
          {lines.map(({ product, quantity }) => (
            <li key={product.id} className="flex justify-between gap-3">
              <span>
                {quantity} × {product.name}
              </span>
              <span className="font-semibold tabular-nums">
                {money(product.price * quantity)}
              </span>
            </li>
          ))}
          <li className="mt-1 flex justify-between gap-3 border-t border-line pt-2 font-bold">
            <span>Total</span>
            <span className="tabular-nums">{money(total)}</span>
          </li>
        </ul>
        <form
          ref={formRef}
          action={send}
          className="flex flex-col gap-4"
          noValidate
        >
          {error && <Alert tone="error">{error}</Alert>}
          <FormField
            label="Votre nom"
            name="name"
            autoComplete="name"
            required
            maxLength={120}
            error={fieldErrors.name}
          />
          <FormField
            label="Votre téléphone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            hint="La boutique vous appelle ou vous écrit sur ce numéro."
            required
            maxLength={30}
            error={fieldErrors.phone}
          />
          <FormField
            label="Quartier ou adresse de livraison"
            name="area"
            autoComplete="street-address"
            required
            maxLength={160}
            error={fieldErrors.area}
          />
          <FormField
            label="Un mot pour la boutique (facultatif)"
            name="note"
            maxLength={500}
            error={fieldErrors.note}
          />
          {fieldErrors.lines && <Alert tone="error">{fieldErrors.lines}</Alert>}
          <button
            type="submit"
            disabled={pending}
            aria-disabled={pending}
            className={buttonClasses('sell')}
          >
            {pending ? 'Envoi…' : 'Envoyer la commande'}
          </button>
        </form>
      </BottomSheet>
    </>
  );
}

function ShopHeader({ catalog }: { catalog: PublicCatalogDto }) {
  const { shop } = catalog;
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {shop.logoVersion ? (
          // eslint-disable-next-line @next/next/no-img-element -- small logo served by the API, already resized
          <img
            src={`/b/${shop.slug}/logo?v=${shop.logoVersion}`}
            alt=""
            className="size-16 rounded-2xl border border-line bg-surface object-contain"
          />
        ) : null}
        <h1 className="text-2xl font-bold">{shop.name}</h1>
      </div>
      {shop.note && <p className="text-base">{shop.note}</p>}
      <p className="text-base text-ink-muted">
        Choisissez vos articles, puis envoyez la commande : la boutique vous
        recontacte.
      </p>
    </header>
  );
}

function ProductRow({
  slug,
  product,
  price,
  quantity,
  onChange,
}: {
  slug: string;
  product: PublicProductDto;
  price: string;
  quantity: number;
  onChange: (quantity: number) => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm">
      {product.photoVersion ? (
        // eslint-disable-next-line @next/next/no-img-element -- photo served by the API, already resized
        <img
          src={`/b/${slug}/photo/${product.id}?v=${product.photoVersion}`}
          alt=""
          loading="lazy"
          className="size-20 shrink-0 rounded-xl bg-surface-muted object-cover"
        />
      ) : (
        <span className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink-muted">
          <Package aria-hidden className="size-8" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-base font-bold break-words">{product.name}</p>
        <p className="text-base">
          <span className="font-semibold">{price}</span>
          <span className="text-ink-muted"> / {UNITS[product.unit].label}</span>
        </p>
        {!product.available ? (
          <span>
            <Badge tone="danger">Épuisé</Badge>
          </span>
        ) : quantity === 0 ? (
          <button
            type="button"
            onClick={() => onChange(1)}
            aria-label={`Ajouter ${product.name}`}
            className={buttonClasses('secondary', 'self-start')}
          >
            <Plus aria-hidden className="size-5" />
            Ajouter
          </button>
        ) : (
          <div
            role="group"
            aria-label={`Quantité de ${product.name}`}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => onChange(quantity - 1)}
              aria-label={`Retirer un ${product.name}`}
              className={buttonClasses('secondary', 'w-12 px-0')}
            >
              <Minus aria-hidden className="size-5" />
            </button>
            <span
              aria-live="polite"
              className="min-w-8 text-center text-lg font-bold tabular-nums"
            >
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => onChange(quantity + 1)}
              aria-label={`Ajouter un ${product.name}`}
              className={buttonClasses('secondary', 'w-12 px-0')}
            >
              <Plus aria-hidden className="size-5" />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

/** Sent: the reference, how to pay it, and the way to the shop. */
function Receipt({
  slug,
  receipt,
}: {
  slug: string;
  receipt: PublicOrderReceiptDto;
}) {
  const { shop } = receipt;
  const money = (amount: number) => formatAmount(amount, receipt.currency);
  const message = `Bonjour ${shop.name}, je viens de passer la commande ${receipt.reference} de ${money(receipt.total)}.`;
  const numbers = [
    shop.payment.wave && { label: 'Wave', number: shop.payment.wave },
    shop.payment.orangeMoney && {
      label: 'Orange Money',
      number: shop.payment.orangeMoney,
    },
  ].filter((item): item is { label: string; number: string } => Boolean(item));
  return (
    <section
      aria-labelledby="receipt-title"
      className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-sm"
    >
      <h1
        id="receipt-title"
        className="flex items-center gap-2 text-2xl font-bold"
      >
        <CircleCheck aria-hidden className="size-8 text-sales-strong" />
        Commande envoyée
      </h1>
      <p className="text-base">
        {shop.name} a reçu votre commande et vous recontacte pour la livraison.
      </p>
      <div className="rounded-xl bg-surface-muted p-4">
        <p className="text-base text-ink-muted">Votre référence</p>
        <p className="text-3xl font-bold tracking-wider">{receipt.reference}</p>
        <p className="mt-1 text-base">
          Total : <span className="font-bold">{money(receipt.total)}</span>
        </p>
      </div>
      {receipt.wave && (
        <div className="flex flex-col gap-2 text-base">
          <h2 className="text-lg font-bold">Payer maintenant</h2>
          <WavePayButton slug={slug} orderId={receipt.id} />
        </div>
      )}
      {numbers.length > 0 ? (
        <div className="flex flex-col gap-2 text-base">
          <h2 className="text-lg font-bold">
            {receipt.wave ? 'Ou payer au numéro' : 'Payer maintenant'}
          </h2>
          <ul className="flex flex-col gap-1">
            {numbers.map(({ label, number }) => (
              <li key={label}>
                {label} : <span className="font-bold">{number}</span>
              </li>
            ))}
          </ul>
          <p>
            Indiquez la référence{' '}
            <span className="font-bold">{receipt.reference}</span> avec le
            paiement. Vous pouvez aussi payer à la livraison si la boutique
            l’accepte.
          </p>
        </div>
      ) : receipt.wave ? null : (
        <p className="text-base">La boutique vous dira comment payer.</p>
      )}
      <a
        href={whatsappLink(message, shop.phone, shop.phoneCountryCode)}
        target="_blank"
        rel="noreferrer"
        className={buttonClasses('secondary')}
      >
        <MessageCircle aria-hidden className="size-5" />
        Écrire à la boutique sur WhatsApp
      </a>
    </section>
  );
}
