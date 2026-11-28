'use client';

import {
  AVAILABILITY_LABELS,
  formatAmount,
  STOREFRONT_HONEYPOT,
  UNITS,
  type PublicArticleDto,
  type PublicOrderResultDto,
  type PublicStorefrontDto,
} from '@nagaw/shared';
import {
  ArrowRight,
  Banknote,
  Check,
  ChevronLeft,
  Clock,
  ImageIcon,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Search,
  Share2,
  Store,
} from 'lucide-react';
import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';
import { countStorefrontVisit, sendStorefrontOrder } from './actions';

type Cart = Record<string, number>;
type Step = 'browse' | 'when' | 'who' | 'sent';

const cartKey = (slug: string) => `nagaw.vitrine.${slug}.panier`;

/**
 * The cart is kept in this browser only; nothing is vital in it. A small
 * store over localStorage: the server renders an empty cart, the browser
 * the one kept (useSyncExternalStore, no effect to copy it).
 */
const EMPTY: Cart = {};
const listeners = new Set<() => void>();
const snapshots = new Map<string, { raw: string | null; cart: Cart }>();

function readCart(slug: string): Cart {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(cartKey(slug));
  } catch (error) {
    console.error('Panier illisible', error);
  }
  const known = snapshots.get(slug);
  if (known && known.raw === raw) return known.cart;
  let cart: Cart = EMPTY;
  try {
    const value: unknown = raw ? JSON.parse(raw) : {};
    if (value && typeof value === 'object')
      cart = Object.fromEntries(
        Object.entries(value).filter(
          (e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0,
        ),
      );
  } catch (error) {
    console.error('Panier illisible', error);
  }
  snapshots.set(slug, { raw, cart });
  return cart;
}

function writeCart(slug: string, cart: Cart) {
  try {
    window.localStorage.setItem(cartKey(slug), JSON.stringify(cart));
  } catch (error) {
    // Private browsing: the cart lives as long as the page.
    console.error('Panier non gardé', error);
    snapshots.set(slug, { raw: JSON.stringify(cart), cart });
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const weekday = (day: string, style: 'short' | 'long') =>
  new Intl.DateTimeFormat('fr-FR', {
    weekday: style,
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
const dayNumber = (day: string) => String(Number(day.slice(8, 10)));
const dayLong = (day: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));

const unitLabel = (a: PublicArticleDto) =>
  a.kind === 'service'
    ? 'Service'
    : `À la ${UNITS[a.unit].label}`.replace('À la pièce', 'La pièce');

const PILL_ON = 'border-2 border-brand-strong bg-brand-soft text-brand-ink';
const PILL_OFF = 'border border-line-strong bg-canvas text-ink';
const FIELD =
  'min-h-12 w-full rounded-2xl border border-line-strong bg-canvas px-4 text-base text-ink';

function Photo({
  article,
  url,
}: {
  article: PublicArticleDto;
  url: string | null;
}) {
  return url ? (
    // The API serves the photo resized on the shop's phone.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      className="aspect-square w-full rounded-3xl object-cover"
    />
  ) : (
    <div
      aria-hidden
      className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-3xl bg-surface text-ink-muted"
    >
      <ImageIcon className="size-8" />
      <span className="text-sm font-bold">{article.name.slice(0, 1)}</span>
    </div>
  );
}

export function StorefrontShop({
  storefront,
  photos,
  logo,
  siteUrl,
}: {
  storefront: PublicStorefrontDto;
  /** Photo address of each article, by its handle. */
  photos: Record<string, string>;
  logo: string | null;
  siteUrl: string;
}) {
  const { slug, articles, currency } = storefront;
  const money = (value: number) => formatAmount(value, currency);
  const cart = useSyncExternalStore(
    subscribe,
    () => readCart(slug),
    () => EMPTY,
  );
  const [step, setStep] = useState<Step>('browse');
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [dueOn, setDueOn] = useState(storefront.today);
  const [otherDay, setOtherDay] = useState(false);
  const [dueTime, setDueTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [trap, setTrap] = useState('');
  const [error, setError] = useState<{
    message: string;
    fields: Record<string, string>;
  } | null>(null);
  const [sent, setSent] = useState<PublicOrderResultDto | null>(null);
  const [sending, startSending] = useTransition();
  // One operation per order: a retry after a network failure is the same.
  const [operation, setOperation] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try {
      const key = `nagaw.vitrine.${slug}.vue`;
      if (!window.sessionStorage.getItem(key)) {
        window.sessionStorage.setItem(key, '1');
        void countStorefrontVisit(slug);
      }
    } catch (error) {
      console.error('Visite non comptée', error);
    }
  }, [slug]);

  // The focus follows the step (WCAG 2.4.3): the button pressed is gone.
  useEffect(() => {
    if (step !== 'browse') heading.current?.focus();
  }, [step]);

  const bySlug = useMemo(
    () => new Map(articles.map((a) => [a.handle, a])),
    [articles],
  );
  const categories = useMemo(
    () => [
      ...new Set(
        articles.map((a) => a.category).filter((c): c is string => !!c),
      ),
    ],
    [articles],
  );
  const shown = articles.filter(
    (a) =>
      (category === null || a.category === category) &&
      (query.trim() === '' ||
        a.name.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const lines = Object.entries(cart)
    .map(([handle, quantity]) => ({ article: bySlug.get(handle), quantity }))
    .filter(
      (l): l is { article: PublicArticleDto; quantity: number } =>
        !!l.article && l.article.availability !== 'sold_out',
    );
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  const total = lines.reduce(
    (sum, l) => sum + (l.article.price ?? 0) * l.quantity,
    0,
  );
  const onRequest = lines.some((l) => l.article.price === null);
  const needsTime = lines.some((l) => l.article.kind === 'service');

  const setQuantity = (handle: string, quantity: number) => {
    const next = { ...readCart(slug) };
    if (quantity <= 0) delete next[handle];
    else next[handle] = quantity;
    writeCart(slug, next);
  };

  const whatsappShop = (text: string) =>
    storefront.whatsapp
      ? `https://wa.me/${storefront.whatsapp}?text=${encodeURIComponent(text)}`
      : null;
  const share = async () => {
    const url = `${siteUrl}/b/${slug}`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: storefront.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Partage impossible', error);
    }
  };

  const send = () => {
    setError(null);
    const id = operation ?? crypto.randomUUID();
    setOperation(id);
    const values = {
      clientOperationId: id,
      lines: lines.map((l) => ({
        article: l.article.handle,
        quantity: l.quantity,
      })),
      dueOn,
      dueTime: dueTime || null,
      name,
      phone,
      note,
      [STOREFRONT_HONEYPOT]: trap,
    };
    startSending(async () => {
      const result = await sendStorefrontOrder(slug, values);
      if (!result.ok) {
        setError({ message: result.message, fields: result.fields ?? {} });
        return;
      }
      setOperation(null);
      setSent(result.order);
      writeCart(slug, {});
      setStep('sent');
    });
  };

  const back = (to: Step) => (
    <button
      type="button"
      onClick={() => setStep(to)}
      className="flex min-h-12 items-center gap-1 self-start rounded-full pr-4 font-bold"
    >
      <ChevronLeft aria-hidden className="size-5" />
      Retour
    </button>
  );
  const progress = (n: 2 | 3) => (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-bold text-ink-muted">Étape {n} sur 3</p>
      <div
        className="h-1.5 rounded-full bg-line"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={n}
        aria-label={`Étape ${n} sur 3`}
      >
        <div
          className="h-1.5 rounded-full bg-sales-strong"
          style={{ width: n === 2 ? '66%' : '100%' }}
        />
      </div>
    </div>
  );
  const bottomBar = (label: string, onClick: () => void, disabled = false) => (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-canvas px-3 pt-3 pb-4">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <div className="flex flex-1 flex-col pl-1 leading-tight">
          <span className="text-sm text-ink-muted">Payé au retrait</span>
          <span className="text-xl font-black text-sales-ink tabular-nums">
            {money(total)}
            {onRequest ? ' +' : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="flex min-h-14 items-center gap-2 rounded-full bg-ink px-7 text-lg font-extrabold text-canvas disabled:opacity-60"
        >
          {label}
          <ArrowRight aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  );

  // --- Sent ----------------------------------------------------------------
  if (step === 'sent' && sent) {
    const tracking = `${siteUrl}/b/${slug}/suivi/${sent.trackingToken}`;
    const tell = whatsappShop(
      `Bonjour, je viens d’envoyer la commande ${sent.number} sur votre vitrine. Suivi : ${tracking}`,
    );
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-4 py-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-18 items-center justify-center rounded-full bg-sales-soft">
            <Check
              aria-hidden
              className="size-9 text-sales-ink"
              strokeWidth={2.6}
            />
          </span>
          <h1
            ref={heading}
            tabIndex={-1}
            className="text-3xl font-black outline-none"
          >
            Commande envoyée
          </h1>
          <p className="text-lg text-ink-muted">
            {storefront.name} va la confirmer et vous écrira sur WhatsApp.
          </p>
          <p className="rounded-full bg-surface px-4 py-1.5 text-lg font-extrabold tabular-nums">
            Commande {sent.number}
          </p>
        </div>
        {tell && (
          <a
            href={tell}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-ink text-lg font-extrabold text-canvas"
          >
            <MessageCircle aria-hidden className="size-5" />
            Prévenir la boutique sur WhatsApp
          </a>
        )}
        <a
          href={tracking}
          className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-surface text-lg font-bold"
        >
          Suivre ma commande
        </a>
        <p className="text-center text-ink-muted">
          Gardez ce lien : il montre où en est votre commande. Vous payez en
          venant la chercher.
        </p>
        <button
          type="button"
          onClick={() => setStep('browse')}
          className="min-h-12 font-bold text-brand-ink underline"
        >
          Revoir la vitrine
        </button>
      </main>
    );
  }

  // --- Step 2: when ----------------------------------------------------------
  if (step === 'when') {
    const days = [0, 1, 2].map((n) => addDays(storefront.today, n));
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-4 pt-3 pb-36">
        {back('browse')}
        {progress(2)}
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-3xl font-black outline-none"
        >
          Quand passez-vous ?
        </h1>

        <section
          aria-labelledby="h-cart"
          className="flex flex-col gap-3 rounded-3xl bg-surface p-4"
        >
          <h2 id="h-cart" className="font-extrabold">
            Ma commande
          </h2>
          <ul className="flex flex-col gap-3">
            {lines.map(({ article, quantity }) => (
              <li key={article.handle} className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold">{article.name}</span>
                  <span className="text-sm text-ink-muted tabular-nums">
                    {article.price === null
                      ? 'Prix sur demande'
                      : `${quantity} × ${money(article.price)} = ${money(quantity * article.price)}`}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(article.handle, quantity - 1)}
                    aria-label={`Enlever un ${article.name}`}
                    className="flex size-11 items-center justify-center rounded-full border border-line-strong bg-canvas"
                  >
                    <Minus aria-hidden className="size-5" />
                  </button>
                  <span
                    className="min-w-6 text-center font-extrabold tabular-nums"
                    aria-live="polite"
                  >
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(article.handle, quantity + 1)}
                    aria-label={`Ajouter un ${article.name}`}
                    className="flex size-11 items-center justify-center rounded-full border border-line-strong bg-canvas"
                  >
                    <Plus aria-hidden className="size-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {onRequest && (
            <p className="text-sm text-ink-muted">
              La boutique donnera le prix de ce qui est « sur demande ».
            </p>
          )}
        </section>

        <section aria-labelledby="h-where" className="flex flex-col gap-2">
          <h2 id="h-where" className="text-lg font-extrabold">
            Où
          </h2>
          <div className={`flex items-start gap-3 rounded-3xl p-4 ${PILL_ON}`}>
            <Store aria-hidden className="mt-0.5 size-6 shrink-0" />
            <p>
              <strong className="block">Je viens chercher à la boutique</strong>
              <span className="text-ink">
                {storefront.landmark || storefront.name}
              </span>
            </p>
          </div>
        </section>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-lg font-extrabold">Quel jour ?</legend>
          <div className="grid grid-cols-4 gap-2">
            {days.map((day, n) => {
              const on = !otherDay && dueOn === day;
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  aria-label={dayLong(day)}
                  onClick={() => {
                    setOtherDay(false);
                    setDueOn(day);
                  }}
                  className={`flex min-h-20 flex-col items-center justify-center rounded-2xl ${on ? PILL_ON : PILL_OFF}`}
                >
                  <span className="text-sm font-bold">
                    {n === 0
                      ? 'Auj.'
                      : n === 1
                        ? 'Demain'
                        : weekday(day, 'short')}
                  </span>
                  <span className="text-2xl font-black tabular-nums">
                    {dayNumber(day)}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={otherDay}
              onClick={() => setOtherDay(true)}
              className={`flex min-h-20 flex-col items-center justify-center rounded-2xl ${otherDay ? PILL_ON : PILL_OFF}`}
            >
              <span className="text-sm font-bold">Autre</span>
              <span className="text-sm font-bold">jour</span>
            </button>
          </div>
          {otherDay && (
            <label className="flex flex-col gap-1.5 font-bold">
              Choisir le jour
              <input
                type="date"
                min={storefront.today}
                max={addDays(storefront.today, 30)}
                value={dueOn}
                onChange={(e) => setDueOn(e.target.value)}
                className={FIELD}
              />
            </label>
          )}
          {storefront.hours && (
            <p className="flex items-center gap-2 text-ink-muted">
              <Clock aria-hidden className="size-4" />
              {storefront.hours}
            </p>
          )}
        </fieldset>

        <label className="flex flex-col gap-1.5 text-lg font-extrabold">
          <span>
            Vers quelle heure ?{' '}
            <span className="text-sm font-semibold text-ink-muted">
              {needsTime ? '(pour le rendez-vous)' : '(facultatif)'}
            </span>
          </span>
          <input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            className={`${FIELD} font-normal`}
          />
        </label>

        <p className="flex items-start gap-3 rounded-3xl bg-sales-soft p-4 font-bold text-sales-ink">
          <Banknote aria-hidden className="size-6 shrink-0" />
          Vous payez en venant chercher votre commande.
        </p>
        {bottomBar('Continuer', () => setStep('who'), lines.length === 0)}
      </main>
    );
  }

  // --- Step 3: who -------------------------------------------------------------
  if (step === 'who') {
    const fields = error?.fields ?? {};
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-4 pt-3 pb-36">
        {back('when')}
        {progress(3)}
        <div className="flex flex-col gap-1">
          <h1
            ref={heading}
            tabIndex={-1}
            className="text-3xl font-black outline-none"
          >
            Qui êtes-vous ?
          </h1>
          <p className="text-ink-muted">
            Pour que la boutique vous écrive. Pas de compte à créer.
          </p>
        </div>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          noValidate
        >
          {error && (
            <p
              role="alert"
              className="rounded-2xl bg-danger-soft p-4 font-bold text-danger-ink"
            >
              {error.message}
              {fields.dueOn ? ` ${fields.dueOn}` : ''}
              {Object.entries(fields)
                .filter(([key]) => key.startsWith('lines'))
                .map(([, message]) => ` ${message}`)
                .join('')}
            </p>
          )}
          <label className="flex flex-col gap-1.5 font-extrabold">
            Prénom et nom
            <input
              name="name"
              autoComplete="name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={fields.name ? true : undefined}
              aria-describedby={fields.name ? 'err-name' : undefined}
              className={`${FIELD} font-normal`}
            />
            {fields.name && (
              <span id="err-name" className="font-bold text-danger-ink">
                {fields.name}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1.5 font-extrabold">
            Téléphone (WhatsApp)
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={30}
              placeholder="77 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={fields.phone ? true : undefined}
              aria-describedby={fields.phone ? 'err-phone' : undefined}
              className={`${FIELD} font-normal tabular-nums`}
            />
            {fields.phone && (
              <span id="err-phone" className="font-bold text-danger-ink">
                {fields.phone}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1.5 font-extrabold">
            <span>
              Un mot pour la boutique{' '}
              <span className="text-sm font-semibold text-ink-muted">
                (facultatif)
              </span>
            </span>
            <textarea
              name="note"
              rows={3}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${FIELD} py-3 font-normal`}
            />
          </label>
          {/* People never see this field; robots fill it (ADR-075). */}
          <div
            aria-hidden
            className="absolute -left-[9999px] h-px w-px overflow-hidden"
          >
            <label>
              Site web
              <input
                tabIndex={-1}
                autoComplete="off"
                name={STOREFRONT_HONEYPOT}
                value={trap}
                onChange={(e) => setTrap(e.target.value)}
              />
            </label>
          </div>
          <section
            aria-labelledby="h-sum"
            className="flex flex-col gap-2 rounded-3xl bg-surface p-4"
          >
            <h2 id="h-sum" className="font-extrabold">
              Ce que j’envoie
            </h2>
            <p className="flex justify-between gap-3">
              <span className="text-ink-muted">Articles</span>
              <span className="font-bold">
                {count} {count > 1 ? 'articles' : 'article'}
              </span>
            </p>
            <p className="flex justify-between gap-3">
              <span className="text-ink-muted">Retrait</span>
              <span className="text-right font-bold first-letter:uppercase">
                {dayLong(dueOn)}
                {dueTime ? ` vers ${dueTime.replace(':', ' h ')}` : ''}
              </span>
            </p>
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-ink-muted">Total</span>
              <span className="text-xl font-black text-sales-ink tabular-nums">
                {money(total)}
              </span>
            </p>
            {onRequest && (
              <p className="text-sm text-ink-muted">
                + le prix de ce qui est sur demande, donné par la boutique.
              </p>
            )}
          </section>
          <p className="text-sm text-ink-muted">
            Votre nom et votre numéro ne servent qu’à {storefront.name} pour
            cette commande.{' '}
            <Link
              href="/confidentialite"
              className="font-bold text-brand-ink underline"
            >
              Vos données
            </Link>
          </p>
          <button type="submit" className="sr-only">
            Envoyer ma commande
          </button>
        </form>
        {bottomBar(sending ? 'Envoi…' : 'Envoyer', send, sending)}
      </main>
    );
  }

  // --- Step 1: the storefront ------------------------------------------------
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col pb-32">
      <div aria-hidden className="h-24 bg-ink" />
      <header className="relative -mt-9 flex flex-col gap-3 px-4 pb-4">
        <div className="flex items-end justify-between">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt=""
              className="size-18 rounded-full border-4 border-canvas bg-canvas object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-18 items-center justify-center rounded-full border-4 border-canvas bg-brand-soft text-2xl font-black text-brand-ink"
            >
              {storefront.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={share}
              aria-label="Partager cette vitrine"
              className="flex size-11 items-center justify-center rounded-full bg-surface"
            >
              <Share2 aria-hidden className="size-5" />
            </button>
            {storefront.whatsapp && (
              <a
                href={`https://wa.me/${storefront.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 font-extrabold text-canvas"
              >
                <MessageCircle aria-hidden className="size-5" />
                WhatsApp
              </a>
            )}
          </div>
        </div>
        <div>
          <h1 className="text-3xl leading-tight font-black">
            {storefront.name}
          </h1>
          {storefront.tagline && (
            <p className="text-lg text-ink-muted">{storefront.tagline}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-ink-muted">
          {storefront.landmark && (
            <span className="flex items-center gap-1.5">
              <MapPin aria-hidden className="size-4" />
              {storefront.landmark}
            </span>
          )}
          {storefront.hours && (
            <span className="flex items-center gap-1.5">
              <Clock aria-hidden className="size-4" />
              {storefront.hours}
            </span>
          )}
        </div>
      </header>

      <ul className="mx-4 grid grid-cols-3 gap-1 rounded-3xl bg-surface p-3 text-center text-sm leading-tight font-bold">
        <li className="flex flex-col items-center gap-1.5">
          <Banknote aria-hidden className="size-5 text-sales-ink" />
          Payez au retrait
        </li>
        <li className="flex flex-col items-center gap-1.5">
          <Store aria-hidden className="size-5 text-brand-ink" />
          Retrait à la boutique
        </li>
        <li className="flex flex-col items-center gap-1.5">
          <MessageCircle aria-hidden className="size-5" />
          Réponse sur WhatsApp
        </li>
      </ul>

      <div className="sticky top-0 z-10 flex flex-col gap-3 bg-canvas pt-4 pb-2">
        <label className="mx-4 flex min-h-12 items-center gap-2 rounded-full bg-surface px-4">
          <Search aria-hidden className="size-5 text-ink-muted" />
          <span className="sr-only">Chercher un article</span>
          <input
            type="search"
            placeholder="Chercher un article"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-12 flex-1 bg-transparent text-base outline-offset-4"
          />
        </label>
        {categories.length > 0 && (
          <nav
            aria-label="Catégories"
            className="flex gap-2 overflow-x-auto px-4"
          >
            {[null, ...categories].map((c) => {
              const on = category === c;
              return (
                <button
                  key={c ?? 'tout'}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCategory(c)}
                  className={`min-h-11 shrink-0 rounded-full px-4 font-extrabold ${on ? 'bg-ink text-canvas' : 'border border-line-strong bg-canvas'}`}
                >
                  {c ?? 'Tout'}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      <section aria-label="Articles et services" className="px-4 pt-2">
        {articles.length === 0 ? (
          <p className="rounded-3xl bg-surface p-6 text-center text-lg">
            La boutique prépare sa vitrine. Revenez bientôt, ou écrivez-lui sur
            WhatsApp.
          </p>
        ) : shown.length === 0 ? (
          <p className="rounded-3xl bg-surface p-6 text-center">
            Rien ne correspond à « {query} ».
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
            {shown.map((article) => {
              const quantity = cart[article.handle] ?? 0;
              const out = article.availability === 'sold_out';
              return (
                <li key={article.handle} className="flex flex-col gap-2">
                  <div className={`relative ${out ? 'opacity-60' : ''}`}>
                    <Photo
                      article={article}
                      url={photos[article.handle] ?? null}
                    />
                    {article.availability !== 'available' && (
                      <span
                        className={`absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-sm font-extrabold ${out ? 'bg-ink text-canvas' : 'bg-warning-soft text-warning-ink'}`}
                      >
                        {AVAILABILITY_LABELS[article.availability]}
                      </span>
                    )}
                    {!out && quantity === 0 && (
                      <button
                        type="button"
                        onClick={() => setQuantity(article.handle, 1)}
                        aria-label={`Ajouter ${article.name} à ma commande`}
                        className="absolute right-2 bottom-2 flex size-11 items-center justify-center rounded-full bg-ink text-canvas"
                      >
                        <Plus
                          aria-hidden
                          className="size-6"
                          strokeWidth={2.6}
                        />
                      </button>
                    )}
                    {!out && quantity > 0 && (
                      <div className="absolute inset-x-2 bottom-2 flex h-11 items-center justify-between rounded-full bg-ink text-canvas">
                        <button
                          type="button"
                          onClick={() =>
                            setQuantity(article.handle, quantity - 1)
                          }
                          aria-label={`Enlever un ${article.name}`}
                          className="flex size-11 items-center justify-center"
                        >
                          <Minus aria-hidden className="size-5" />
                        </button>
                        <span
                          className="font-black tabular-nums"
                          aria-live="polite"
                        >
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setQuantity(article.handle, quantity + 1)
                          }
                          aria-label={`Ajouter encore ${article.name}`}
                          className="flex size-11 items-center justify-center"
                        >
                          <Plus aria-hidden className="size-5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col px-0.5">
                    <p
                      className={`tabular-nums ${article.price === null ? 'font-extrabold text-ink-muted' : 'text-lg font-black text-sales-ink'}`}
                    >
                      {article.price === null
                        ? 'Prix sur demande'
                        : money(article.price)}
                    </p>
                    <h2 className="leading-snug font-bold">{article.name}</h2>
                    <p className="text-sm text-ink-muted">
                      {article.description || unitLabel(article)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="mx-4 mt-8 flex flex-col items-center gap-1 border-t border-line pt-5 text-center text-sm text-ink-muted">
        <p>Vous payez en venant chercher votre commande.</p>
        <Link
          href="/"
          className="flex min-h-11 items-center font-extrabold text-brand-ink"
        >
          Vitrine créée avec Naagaw
        </Link>
      </footer>

      {count > 0 && (
        <div className="fixed inset-x-3 bottom-4 z-20 mx-auto max-w-2xl">
          <button
            type="button"
            onClick={() => setStep('when')}
            className="flex min-h-15 w-full items-center gap-3 rounded-full bg-ink p-2 text-left font-extrabold text-canvas"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-canvas text-lg font-black text-ink tabular-nums">
              {count}
            </span>
            <span className="flex flex-1 flex-col leading-tight">
              Voir ma commande
              <span className="text-sm font-bold opacity-80 tabular-nums">
                {money(total)}
                {onRequest ? ' + prix sur demande' : ''}
              </span>
            </span>
            <ArrowRight aria-hidden className="mr-3 size-5" />
          </button>
        </div>
      )}
    </main>
  );
}
