import {
  ArrowRight,
  BookOpenCheck,
  Calculator,
  ChartColumn,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  FileText,
  HandCoins,
  History,
  Lock,
  Package,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { formatAmount, type PlanDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import Image from 'next/image';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ArticleCard } from '@/components/blog/article-card';
import { JsonLd } from '@/components/json-ld';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { ScrollRegion } from '@/components/ui/scroll-region';
import { apiPublic } from '@/lib/api/server';
import { getArticle } from '@/lib/blog/articles';
import { siteUrl } from '@/lib/env';
import { PLAN_LIMITS, planCount } from '@/lib/plans';
import { SITE_SUMMARY } from '@/lib/seo';
import {
  appId,
  faqPage,
  graph,
  organization,
  softwareApplication,
  website,
} from '@/lib/structured-data';

const TITLE = 'Nagaw Business — caisse, stock et argent de votre boutique';
const DESCRIPTION =
  'Tenez votre boutique au franc près depuis votre téléphone : caisse qui marche sans internet, stock, crédit des clients, Wave et Orange Money, factures et comptabilité SYSCOHADA. Gratuit pour commencer.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'logiciel de gestion de boutique',
    'application de caisse',
    'logiciel de caisse gratuit',
    'gestion de stock',
    'caisse hors ligne',
    'Wave',
    'Orange Money',
    'SYSCOHADA',
    'Sénégal',
  ],
  alternates: { canonical: '/' },
  openGraph: { url: '/', title: TITLE, description: DESCRIPTION },
  twitter: { title: TITLE, description: DESCRIPTION },
};

// Copy rule: every promise below is a delivered feature
// (IMPLEMENTATION_STATUS.md, Phases 9 to 16). No testimonial, no user count
// and no price is written here: there is none yet, and prices are in base.

const REASSURANCE = [
  'Gratuit pour commencer',
  'Sans carte bancaire',
  'Marche sans internet',
  'En français et en F CFA',
];

const SHOP_KINDS = [
  'Électronique',
  'Alimentation',
  'Quincaillerie',
  'Cosmétiques',
  'Prêt-à-porter',
  'Pièces détachées',
];

/** Everyday problems, and what the app does about each. */
const PAINS: { before: string; after: string; icon: LucideIcon }[] = [
  {
    before: 'Je ne sais plus ce qui reste en stock.',
    after:
      'Chaque vente retire le stock toute seule, et la liste « bientôt épuisés » vous dit quoi racheter.',
    icon: Package,
  },
  {
    before: 'Les clients à crédit oublient de payer.',
    after:
      '« Ils me doivent » : qui vous doit et combien, avec le total à récupérer.',
    icon: HandCoins,
  },
  {
    before: 'Mon argent est partout : caisse, Wave, Orange Money.',
    after:
      'Chaque caisse a son solde, calculé à partir des ventes et des dépenses.',
    icon: Wallet,
  },
  {
    before: 'Le soir, il manque de l’argent et je ne sais pas pourquoi.',
    after:
      'Clôturez la caisse : vous comptez, l’application dit tout de suite s’il manque quelque chose.',
    icon: Calculator,
  },
  {
    before: 'Je vends beaucoup, mais est-ce que je gagne ?',
    after:
      'Chiffre d’affaires, marge et bénéfice estimé, du jour, de la semaine ou du mois.',
    icon: TrendingUp,
  },
  {
    before: 'Mes vendeurs voient tout.',
    after:
      'Chacun a son rôle : un vendeur encaisse, il ne voit ni la caisse ni les chiffres.',
    icon: UserCheck,
  },
];

const MODULES: {
  title: string;
  text: string;
  icon: LucideIcon;
  card: string;
  badge: string;
}[] = [
  {
    title: 'Vendre',
    text: 'De grandes tuiles, le total en grand, la monnaie à rendre calculée. Espèces, Mobile Money, carte ou crédit. Ticket sur WhatsApp ou à l’imprimante.',
    icon: ShoppingCart,
    card: 'bg-sales-soft text-sales-ink',
    badge: 'bg-sales-strong text-white',
  },
  {
    title: 'Stock et produits',
    text: 'Entrées de marchandise, pertes et inventaire. Le stock n’est jamais écrasé : chaque mouvement est gardé.',
    icon: Package,
    card: 'bg-stock-soft text-stock-ink',
    badge: 'bg-stock-strong text-white',
  },
  {
    title: 'Factures et devis',
    text: 'Numérotés sans trou, impossibles à réécrire une fois émis. Le PDF part sur WhatsApp ou par e-mail depuis le téléphone.',
    icon: FileText,
    card: 'bg-invoices-soft text-invoices-ink',
    badge: 'bg-invoices-strong text-white',
  },
  {
    title: 'Argent et chiffres',
    text: 'Caisse, Wave, Orange Money, Free Money et banque. Dépenses, clôture de caisse, produits qui se vendent et ceux qui dorment.',
    icon: ChartColumn,
    card: 'bg-stats-soft text-stats-ink',
    badge: 'bg-stats-strong text-white',
  },
  {
    title: 'Comptabilité SYSCOHADA',
    text: 'Le journal des recettes et dépenses se remplit tout seul. Votre comptable l’exporte en tableur, sans rien ressaisir.',
    icon: BookOpenCheck,
    card: 'bg-accounting-soft text-accounting-ink',
    badge: 'bg-accounting-strong text-white',
  },
  {
    title: 'Équipe et boutiques',
    text: 'Invitez vos vendeurs, gérez plusieurs boutiques avec un seul compte et comparez leurs chiffres.',
    icon: Users,
    card: 'bg-brand-soft text-brand-ink',
    badge: 'bg-brand-strong text-white',
  },
];

const TRUST: { title: string; text: string; icon: LucideIcon }[] = [
  {
    title: 'Hébergé à Paris',
    text: 'Vos données sont gardées en ligne, sur des serveurs en France. Un téléphone perdu ne fait pas perdre la boutique.',
    icon: ShieldCheck,
  },
  {
    title: 'Chaque boutique à part',
    text: 'Personne d’autre ne voit vos produits, vos clients ni vos chiffres. Vérifié par le serveur à chaque action.',
    icon: Lock,
  },
  {
    title: 'Un historique qu’on n’efface pas',
    text: 'Qui a vendu, annulé ou modifié, et quand. Une vente ne se supprime pas : elle s’annule avec un motif.',
    icon: History,
  },
];

const STEPS = [
  {
    title: 'Créez votre compte',
    text: 'Une adresse e-mail et un mot de passe, puis le nom de votre boutique. Deux minutes.',
  },
  {
    title: 'Ajoutez vos produits',
    text: 'Le nom, le prix et ce que vous avez en stock. Une photo si vous voulez.',
  },
  {
    title: 'Vendez',
    text: 'Le stock, la caisse et vos chiffres se mettent à jour à chaque vente.',
  },
];

/** What every offer includes: only the limits change (ADR-029). */
const INCLUDED = [
  'Caisse qui marche sans internet',
  'Stock, clients et crédit',
  'Factures et devis en PDF',
  'Caisses, dépenses et clôture',
  'Statistiques et comptabilité SYSCOHADA',
  'Historique des actions',
];

/** Who each offer suits, by its key; an unknown offer simply has none. */
const PLAN_PITCH: Record<string, string> = {
  free: 'Pour essayer avec vos premiers produits.',
  essential: 'Pour une petite boutique et son équipe.',
  pro: 'Pour une boutique qui grandit, sans limite de produits.',
};

const FAQ: { question: string; answer: string }[] = [
  { question: 'Qu’est-ce que Nagaw Business ?', answer: SITE_SUMMARY },
  {
    question: 'Faut-il internet pour vendre ?',
    answer:
      'Non. La caisse s’ouvre sans connexion et garde les ventes sur le téléphone, puis les envoie toute seule dès que le réseau revient. Le stock, les factures et les chiffres demandent une connexion.',
  },
  {
    question: 'Faut-il installer une application ?',
    answer:
      'Non. Nagaw Business s’ouvre dans le navigateur du téléphone ou de l’ordinateur. Vous pouvez l’ajouter à l’écran d’accueil : il s’ouvre alors comme une application.',
  },
  {
    question: 'Combien ça coûte, et comment payer ?',
    answer:
      'L’offre gratuite permet de commencer sans payer et sans carte bancaire. Une offre payante se demande depuis l’application ; le paiement en ligne n’est pas encore ouvert : l’équipe Nagaw vous contacte pour le règlement.',
  },
  {
    question: 'Mes vendeurs peuvent-ils l’utiliser ?',
    answer:
      'Oui, invitez-les par e-mail. Un vendeur encaisse et voit ses ventes. L’argent, les chiffres et les factures restent réservés au propriétaire et aux gérants, et tout est noté dans l’historique.',
  },
  {
    question: 'Puis-je imprimer un ticket ?',
    answer:
      'Oui, au format des petites imprimantes de caisse (58 mm), par l’imprimante branchée au téléphone ou à l’ordinateur. Vous pouvez aussi envoyer le ticket sur WhatsApp.',
  },
  {
    question: 'Et ma comptabilité ?',
    answer:
      'Les recettes et les dépenses sont classées selon le SYSCOHADA. Votre comptable exporte le journal et l’état de fin d’année en tableur.',
  },
  {
    question: 'J’ai plusieurs boutiques.',
    answer:
      'Créez-les toutes avec le même compte. Chacune a ses produits, son équipe et son offre, et vous comparez leurs chiffres.',
  },
];

// Real screenshots of the app (scripts/capture-screens.mjs), taken on a
// phone and on a computer with a demonstration electronics shop; the page
// says so above the gallery.
type Device = 'mobile' | 'desktop';
/** Folder of the last capture run (dated, so that caches never serve old ones). */
const SCREENS_DIR = '/screens/2026-10-26';
const screen = (device: Device, name: string) =>
  `${SCREENS_DIR}/${device}/${name}.png`;

const SCREENS: {
  name: string;
  title: string;
  alt: Record<Device, string>;
}[] = [
  {
    name: 'vendre',
    title: 'La caisse',
    alt: {
      mobile:
        'Écran Vendre sur téléphone : trois téléphones avec leur prix en F CFA, un Samsung Galaxy A15 choisi et le bouton Encaisser — 139 500 F CFA.',
      desktop:
        'Écran Vendre sur ordinateur : tout le catalogue en tuiles avec les prix en F CFA, et le panier à droite avec 139 500 F CFA à payer.',
    },
  },
  {
    name: 'produits',
    title: 'Le stock',
    alt: {
      mobile:
        'Téléphones en stock sur téléphone : iPhone 13 bientôt épuisé (2 pièces), Itel A70, Samsung Galaxy A15 et Tecno Spark 20, avec leur prix.',
      desktop:
        'Produits sur ordinateur, filtrés sur les téléphones : iPhone 13 bientôt épuisé, Itel A70, Samsung Galaxy A15 et Tecno Spark 20, avec prix et stock.',
    },
  },
  {
    name: 'facture',
    title: 'Une facture',
    alt: {
      mobile:
        'Facture sur téléphone pour le Cabinet Ndiaye & Associés : 3 Samsung Galaxy A15, 3 chargeurs et 2 souris, TVA 18 % et total TTC de 374 500 F CFA.',
      desktop:
        'Facture F-2026-0001 sur ordinateur pour le Cabinet Ndiaye & Associés : trois lignes, total hors taxes, TVA 18 % et 374 500 F CFA à payer.',
    },
  },
  {
    name: 'statistiques',
    title: 'Les chiffres',
    alt: {
      mobile:
        'Statistiques du jour sur téléphone : 350 500 F CFA de chiffre d’affaires, 7 ventes, panier moyen, marge brute et dépenses.',
      desktop:
        'Statistiques sur ordinateur : chiffre d’affaires, ventes, panier moyen, marge, dépenses et graphique du chiffre d’affaires par jour.',
    },
  },
];

function PhoneScreen({
  src,
  alt,
  priority = false,
  className = '',
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[2.25rem] border-[6px] border-ink bg-surface shadow-xl ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        width={824}
        height={1678}
        priority={priority}
        sizes="(min-width: 768px) 288px, 70vw"
        className="h-auto w-full"
      />
    </div>
  );
}

/** Desktop screenshot in a plain browser frame. */
function DesktopScreen({
  src,
  alt,
  priority = false,
  className = '',
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-xl ${className}`}
    >
      <div aria-hidden className="flex gap-1.5 border-b border-line px-3 py-2">
        <span className="size-2.5 rounded-full bg-danger" />
        <span className="size-2.5 rounded-full bg-warning" />
        <span className="size-2.5 rounded-full bg-sales" />
      </div>
      <Image
        src={src}
        alt={alt}
        width={1920}
        height={1200}
        priority={priority}
        sizes="(min-width: 1024px) 560px, 100vw"
        className="h-auto w-full"
      />
    </div>
  );
}

function SectionTitle({
  id,
  eyebrow,
  title,
  text,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-2">
      {eyebrow && (
        <p className="text-base font-bold tracking-wide text-brand-ink uppercase">
          {eyebrow}
        </p>
      )}
      <h2 id={id} className="text-3xl font-extrabold md:text-4xl">
        {title}
      </h2>
      {text && <p className="text-lg text-ink-muted">{text}</p>}
    </div>
  );
}

/**
 * The offer grid, read from the API at request time: prices and limits are
 * set in the database (ADR-029, ADR-033, ADR-034), never written in the page.
 */
async function Pricing() {
  await connection();
  const plans = await apiPublic<PlanDto[]>('/plans');
  if (!plans.ok)
    console.error('Tarifs indisponibles', plans.status, plans.code);
  if (!plans.ok || plans.data.length === 0)
    return (
      <Alert>
        Les tarifs ne peuvent pas être affichés pour le moment. Chaque boutique
        commence avec l’offre gratuite.
      </Alert>
    );
  const base = siteUrl();
  return (
    <>
      {/* The live grid as offers of the app (merged by its @id). */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          '@id': appId(base),
          offers: plans.data.map((plan) => ({
            '@type': 'Offer',
            name: plan.name,
            price: plan.monthlyPrice,
            priceCurrency: plan.currency,
            url: `${base}/#tarifs`,
          })),
        }}
      />
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {plans.data.map((plan) => {
          const free = plan.monthlyPrice === 0;
          return (
            <li
              key={plan.key}
              className={`flex flex-col gap-4 rounded-3xl border bg-surface p-6 shadow-sm ${
                free ? 'border-2 border-brand-strong' : 'border-line'
              }`}
            >
              <div className="flex flex-col gap-1">
                <h3 className="text-2xl font-extrabold text-brand-ink">
                  {plan.name}
                </h3>
                {PLAN_PITCH[plan.key] && (
                  <p className="text-base text-ink-muted">
                    {PLAN_PITCH[plan.key]}
                  </p>
                )}
              </div>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-4xl font-extrabold tabular-nums">
                  {formatAmount(plan.monthlyPrice, plan.currency)}
                </span>
                <span className="text-lg text-ink-muted">par mois</span>
              </p>
              <ul className="flex flex-1 flex-col gap-2">
                {PLAN_LIMITS.map((limit) => (
                  <li key={limit.key} className="flex items-start gap-2">
                    <Check
                      aria-hidden
                      className="mt-0.5 size-5 shrink-0 text-sales-ink"
                    />
                    <span>
                      {planCount(plan.limits[limit.key], limit.unit)}
                      {limit.detail &&
                        plan.limits[limit.key] !== null &&
                        ` ${limit.detail}`}
                    </span>
                  </li>
                ))}
              </ul>
              <ButtonLink
                href="/inscription"
                variant={free ? 'primary' : 'secondary'}
              >
                {free ? 'Commencer gratuitement' : 'Créer ma boutique'}
              </ButtonLink>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Guides shown on the home page, for readers and for internal links. */
const GUIDES = [
  'logiciel-gestion-boutique',
  'vendre-sans-internet',
  'cloture-de-caisse',
].flatMap((slug) => getArticle(slug) ?? []);

export default function Home() {
  const base = siteUrl();
  return (
    <div className="flex flex-1 flex-col">
      <JsonLd
        data={graph(
          organization(base),
          website(base),
          softwareApplication(base),
          faqPage(FAQ),
        )}
      />
      <SiteHeader />

      <main className="flex flex-1 flex-col">
        {/* Hero: the promise, the action, and the proof next to it. */}
        <section className="bg-brand-soft">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1fr_1.2fr] md:py-20">
            <div className="flex flex-col gap-5">
              <p className="text-base font-bold tracking-wide text-brand-ink uppercase">
                Caisse, stock et argent de votre boutique
              </p>
              <h1 className="text-4xl font-extrabold tracking-tight text-brand-ink md:text-6xl">
                Tenez votre boutique au franc près, depuis votre téléphone
              </h1>
              <p className="text-xl">
                Encaissez vite, voyez ce qui reste en stock, qui vous doit de
                l’argent et ce que vous gagnez vraiment.{' '}
                <strong>Même quand le réseau coupe.</strong>
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ButtonLink
                  href="/inscription"
                  className="text-lg whitespace-nowrap"
                >
                  Créer ma boutique gratuitement
                  <ArrowRight aria-hidden className="size-5" />
                </ButtonLink>
                <ButtonLink
                  href="#tarifs"
                  variant="secondary"
                  className="whitespace-nowrap"
                >
                  Voir les tarifs
                </ButtonLink>
              </div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {REASSURANCE.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 font-semibold"
                  >
                    <CircleCheck
                      aria-hidden
                      className="size-5 shrink-0 text-sales-ink"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative md:pb-12 md:pl-10">
              <DesktopScreen
                src={screen('desktop', 'accueil')}
                alt="Tableau de bord sur ordinateur : menu à gauche, six chiffres clés en couleur (350 500 F CFA de chiffre d’affaires, 53 000 F CFA de bénéfice estimé), choix de la période et ventes du jour."
                priority
                className="hidden md:block"
              />
              <PhoneScreen
                src={screen('mobile', 'accueil')}
                alt="Tableau de bord sur téléphone : chiffre d’affaires de 350 500 F CFA, 7 ventes, panier moyen, marge brute, dépenses et bénéfice estimé dans des cartes de couleur, avec le bouton Vendre."
                priority
                className="mx-auto w-full max-w-64 md:absolute md:bottom-0 md:left-0 md:w-36"
              />
            </div>
          </div>
        </section>

        {/* Who it is for. */}
        <section
          aria-labelledby="kinds-title"
          className="border-b border-line bg-surface"
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 md:flex-row md:items-center">
            <h2 id="kinds-title" className="shrink-0 text-lg font-bold">
              Pour toutes les boutiques qui vendent des produits :
            </h2>
            <ul className="flex flex-wrap gap-2">
              {SHOP_KINDS.map((kind) => (
                <li
                  key={kind}
                  className="rounded-full bg-surface-muted px-4 py-2 font-semibold"
                >
                  {kind}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* The problems, then what changes. */}
        <section
          aria-labelledby="pains-title"
          className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-14"
        >
          <SectionTitle
            id="pains-title"
            eyebrow="Fini le cahier et la calculatrice"
            title="Ce qui vous fait perdre de l’argent, réglé"
            text="Les soucis de tous les jours d’un commerçant, et ce que Nagaw Business fait pour chacun."
          />
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PAINS.map(({ before, after, icon: Icon }) => (
              <li
                key={before}
                className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5 shadow-sm"
              >
                <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
                  <Icon aria-hidden className="size-7" />
                </span>
                <p className="flex items-start gap-2 font-semibold text-danger-ink">
                  <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
                  <span>« {before} »</span>
                </p>
                <p className="flex items-start gap-2 text-ink">
                  <CircleCheck
                    aria-hidden
                    className="mt-0.5 size-5 shrink-0 text-sales-ink"
                  />
                  <span>{after}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Features. */}
        <section
          id="fonctions"
          aria-labelledby="modules-title"
          className="mx-auto flex w-full max-w-6xl scroll-mt-20 flex-col gap-8 px-4 pb-14"
        >
          <SectionTitle
            id="modules-title"
            eyebrow="Une seule application"
            title="Tout pour tenir votre boutique"
            text="Une couleur par partie de l’application, pour vous repérer d’un coup d’œil. De grands boutons et des mots simples."
          />
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(({ title, text, icon: Icon, card, badge }) => (
              <li
                key={title}
                className={`flex flex-col gap-3 rounded-3xl p-5 ${card}`}
              >
                <span
                  className={`flex size-12 items-center justify-center rounded-2xl ${badge}`}
                >
                  <Icon aria-hidden className="size-7" />
                </span>
                <h3 className="text-xl font-extrabold">{title}</h3>
                <p className="text-base text-ink">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Proof: the real app. */}
        <section
          aria-labelledby="screens-title"
          className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-14"
        >
          <SectionTitle
            id="screens-title"
            title="Voyez l’application"
            text="Captures de l’application, avec une boutique d’électronique de démonstration."
          />
          <h3 className="text-xl font-extrabold">Sur téléphone</h3>
          <ScrollRegion label="Captures sur téléphone" className="-mx-4">
            <ul className="flex snap-x snap-mandatory gap-4 px-4 pb-4 lg:grid lg:grid-cols-4">
              {SCREENS.map(({ name, title, alt }) => (
                <li
                  key={name}
                  className="flex w-60 shrink-0 snap-center flex-col gap-3 lg:w-auto"
                >
                  <PhoneScreen src={screen('mobile', name)} alt={alt.mobile} />
                  <p className="text-center text-lg font-bold">{title}</p>
                </li>
              ))}
            </ul>
          </ScrollRegion>
          <h3 className="text-xl font-extrabold">Sur ordinateur</h3>
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {SCREENS.map(({ name, title, alt }) => (
              <li key={name} className="flex flex-col gap-3">
                <DesktopScreen
                  src={screen('desktop', name)}
                  alt={alt.desktop}
                />
                <p className="text-center text-lg font-bold">{title}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* The two differences that matter most on the ground. */}
        <section aria-labelledby="offline-title" className="bg-brand-strong">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 text-white md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-brand-strong">
                <WifiOff aria-hidden className="size-8" />
              </span>
              <h2 id="offline-title" className="text-3xl font-extrabold">
                Plus de réseau ? Continuez à vendre.
              </h2>
              <p className="text-lg">
                La caisse s’ouvre même sans connexion. Les ventes sont gardées
                sur le téléphone, avec leur ticket, puis envoyées toutes seules
                dès que le réseau revient. Aucun client ne repart sans payer
                parce que la connexion a coupé.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-brand-strong">
                <Smartphone aria-hidden className="size-8" />
              </span>
              <h2 className="text-3xl font-extrabold">
                Votre téléphone suffit
              </h2>
              <p className="text-lg">
                Pas de caisse enregistreuse à acheter, rien à télécharger dans
                un magasin d’applications : ajoutez Nagaw Business à l’écran
                d’accueil. Sur ordinateur aussi, pour les factures et les
                chiffres.
              </p>
            </div>
          </div>
        </section>

        {/* Trust. */}
        <section
          aria-labelledby="trust-title"
          className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-14"
        >
          <SectionTitle
            id="trust-title"
            eyebrow="Vos chiffres sont à vous"
            title="Des comptes sûrs, qu’on ne peut pas trafiquer"
          />
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {TRUST.map(({ title, text, icon: Icon }) => (
              <li
                key={title}
                className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5 shadow-sm"
              >
                <span className="flex size-12 items-center justify-center rounded-2xl bg-sales-soft text-sales-ink">
                  <Icon aria-hidden className="size-7" />
                </span>
                <h3 className="text-xl font-extrabold">{title}</h3>
                <p className="text-base text-ink-muted">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Steps. */}
        <section
          aria-labelledby="steps-title"
          className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-14"
        >
          <SectionTitle
            id="steps-title"
            title="Votre première vente aujourd’hui"
            text="Pas de formation, pas de matériel : trois étapes."
          />
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map(({ title, text }, index) => (
              <li
                key={title}
                className="flex gap-4 rounded-3xl border border-line bg-surface p-5"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-strong text-xl font-extrabold text-white">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-extrabold">{title}</h3>
                  <p className="text-base text-ink-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Pricing. */}
        <section
          id="tarifs"
          aria-labelledby="pricing-title"
          className="bg-surface-muted"
        >
          <div className="mx-auto flex w-full max-w-6xl scroll-mt-20 flex-col gap-8 px-4 py-14">
            <SectionTitle
              id="pricing-title"
              eyebrow="Tarifs"
              title="Commencez gratuitement, changez d’offre quand vous grandissez"
              text="Par boutique et par mois. Toutes les offres donnent accès à toute l’application : seules les limites changent."
            />
            <Suspense
              fallback={
                <p role="status" className="text-ink-muted">
                  Chargement des tarifs…
                </p>
              }
            >
              <Pricing />
            </Suspense>
            <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
              <h3 className="text-lg font-extrabold">
                Inclus dans toutes les offres
              </h3>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check
                      aria-hidden
                      className="mt-0.5 size-5 shrink-0 text-sales-ink"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-base text-ink-muted">
              Chaque boutique commence avec l’offre gratuite, sans carte
              bancaire. Vous changez d’offre depuis Paramètres, Abonnement : le
              paiement en ligne n’est pas encore ouvert, l’équipe Nagaw vous
              contacte pour le règlement.
            </p>
          </div>
        </section>

        {/* Objections. */}
        <section
          id="questions"
          aria-labelledby="faq-title"
          className="mx-auto flex w-full max-w-6xl scroll-mt-20 flex-col gap-6 px-4 py-14"
        >
          <SectionTitle id="faq-title" title="Vos questions" />
          <ul className="flex flex-col gap-3">
            {FAQ.map(({ question, answer }) => (
              <li key={question}>
                <details className="group rounded-2xl border border-line bg-surface">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
                    <span className="flex-1">{question}</span>
                    <ChevronDown
                      aria-hidden
                      className="size-6 shrink-0 text-ink-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    />
                  </summary>
                  <p className="px-4 pb-4 text-base text-ink-muted">{answer}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>

        {/* Guides. */}
        <section
          aria-labelledby="guides-title"
          className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-14"
        >
          <SectionTitle
            id="guides-title"
            eyebrow="Guides gratuits"
            title="Des conseils pour mieux gérer votre boutique"
            text="Stock, caisse, crédit, marge, factures : expliqué simplement, avec des exemples en F CFA."
          />
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {GUIDES.map((article) => (
              <li key={article.slug}>
                <ArticleCard article={article} />
              </li>
            ))}
          </ul>
          <ButtonLink href="/blog" variant="secondary" className="self-start">
            Voir tous les guides
            <ArrowRight aria-hidden className="size-5" />
          </ButtonLink>
        </section>

        {/* Last call. */}
        <section className="px-4 pb-16">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 rounded-3xl bg-sales-strong p-6 text-white md:flex-row md:items-center md:justify-between md:p-10">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-extrabold">
                Votre boutique mérite mieux qu’un cahier
              </h2>
              <p className="text-lg">
                Créez-la en deux minutes et faites votre première vente
                aujourd’hui. Gratuit pour commencer, sans carte bancaire.
              </p>
            </div>
            <ButtonLink
              href="/inscription"
              variant="secondary"
              className="shrink-0 text-lg"
            >
              Créer ma boutique gratuitement
            </ButtonLink>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
