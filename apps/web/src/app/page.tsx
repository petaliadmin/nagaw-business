import {
  BookOpenCheck,
  ChartColumn,
  Check,
  FileText,
  Package,
  ShoppingCart,
  Smartphone,
  Users,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { formatAmount, type PlanDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import Image from 'next/image';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { Logo } from '@/components/ui/logo';
import { ScrollRegion } from '@/components/ui/scroll-region';
import { apiPublic } from '@/lib/api/server';
import { PLAN_LIMITS, planCount } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Nagaw Business — votre boutique dans votre téléphone',
};

// Every module listed here is delivered (IMPLEMENTATION_STATUS.md,
// Phases 9 to 14): nothing is announced that the app does not do.
const MODULES: {
  title: string;
  text: string;
  icon: LucideIcon;
  card: string;
  badge: string;
}[] = [
  {
    title: 'Vendre',
    text: 'Touchez les produits, le total s’affiche en grand. Espèces avec la monnaie à rendre, Mobile Money, carte ou crédit.',
    icon: ShoppingCart,
    card: 'bg-sales-soft text-sales-ink',
    badge: 'bg-sales-strong text-white',
  },
  {
    title: 'Produits et stock',
    text: 'Voyez ce qui reste, les produits bientôt épuisés et ce qu’il faut racheter. Chaque vente retire le stock toute seule.',
    icon: Package,
    card: 'bg-stock-soft text-stock-ink',
    badge: 'bg-stock-strong text-white',
  },
  {
    title: 'Factures et devis',
    text: 'Des factures propres, numérotées sans trou, en PDF à envoyer sur WhatsApp. Suivez ce que vos clients vous doivent.',
    icon: FileText,
    card: 'bg-invoices-soft text-invoices-ink',
    badge: 'bg-invoices-strong text-white',
  },
  {
    title: 'Argent et statistiques',
    text: 'Combien vous avez gagné, ce qu’il y a dans la caisse, sur Wave, Orange Money ou à la banque. Vos dépenses aussi.',
    icon: ChartColumn,
    card: 'bg-stats-soft text-stats-ink',
    badge: 'bg-stats-strong text-white',
  },
  {
    title: 'Comptabilité',
    text: 'Le journal des recettes et dépenses SYSCOHADA se remplit tout seul. Votre comptable l’exporte en un geste.',
    icon: BookOpenCheck,
    card: 'bg-accounting-soft text-accounting-ink',
    badge: 'bg-accounting-strong text-white',
  },
  {
    title: 'Équipe',
    text: 'Invitez vos vendeurs. Chacun voit seulement ce qu’il doit voir, et tout est noté dans l’historique.',
    icon: Users,
    card: 'bg-brand-soft text-brand-ink',
    badge: 'bg-brand-strong text-white',
  },
];

const STEPS = [
  {
    title: 'Créez votre compte',
    text: 'Une adresse e-mail et un mot de passe, puis le nom de votre boutique.',
  },
  {
    title: 'Ajoutez vos produits',
    text: 'Le nom, le prix et ce que vous avez en stock. Une photo si vous voulez.',
  },
  {
    title: 'Vendez',
    text: 'Le ticket part sur WhatsApp ou à l’imprimante. Le stock et la caisse se mettent à jour.',
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
    title: 'Les produits',
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

/**
 * The offer grid, read from the API at request time: prices and limits are
 * set in the database (ADR-029, ADR-033), never written in the page.
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
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {plans.data.map((plan) => (
        <li
          key={plan.key}
          className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 shadow-sm"
        >
          <h3 className="text-2xl font-extrabold text-brand-ink">
            {plan.name}
          </h3>
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
            variant={plan.monthlyPrice === 0 ? 'primary' : 'secondary'}
          >
            {plan.monthlyPrice === 0
              ? 'Commencer gratuitement'
              : 'Créer ma boutique'}
          </ButtonLink>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Logo href="/" />
          <div className="flex items-center gap-2">
            <a
              href="#tarifs"
              className="hidden min-h-12 items-center px-3 font-bold text-ink underline-offset-4 hover:underline sm:inline-flex"
            >
              Tarifs
            </a>
            <ButtonLink href="/connexion" variant="secondary" className="px-4">
              Se connecter
            </ButtonLink>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="bg-brand-soft">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1fr_1.2fr] md:py-20">
            <div className="flex flex-col gap-5">
              <h1 className="text-4xl font-extrabold tracking-tight text-brand-ink md:text-6xl">
                Votre boutique dans votre téléphone
              </h1>
              <p className="text-xl font-semibold">
                Vendez, suivez votre stock et votre argent, même sans connexion.
              </p>
              <p className="text-lg text-ink-muted">
                Nagaw Business est fait pour les commerçants : de grands
                boutons, des mots simples et des montants en F CFA.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/inscription" className="text-lg">
                  Créer ma boutique
                </ButtonLink>
                <ButtonLink href="/connexion" variant="secondary">
                  J’ai déjà un compte
                </ButtonLink>
              </div>
              <p className="flex items-center gap-2 font-semibold text-ink">
                <Check aria-hidden className="size-5 text-sales-ink" />
                Gratuit pour commencer, sans carte bancaire
              </p>
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

        <section
          aria-labelledby="modules-title"
          className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14"
        >
          <div className="flex flex-col gap-2">
            <h2 id="modules-title" className="text-3xl font-extrabold">
              Tout pour tenir votre boutique
            </h2>
            <p className="text-lg text-ink-muted">
              Une couleur par partie de l’application, pour vous repérer d’un
              coup d’œil.
            </p>
          </div>
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

        <section
          aria-labelledby="screens-title"
          className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-14"
        >
          <div className="flex flex-col gap-2">
            <h2 id="screens-title" className="text-3xl font-extrabold">
              Voyez l’application
            </h2>
            <p className="text-lg text-ink-muted">
              Captures de l’application avec une boutique d’électronique de
              démonstration.
            </p>
          </div>
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
                La caisse s’ouvre même sans connexion. Vos ventes sont gardées
                sur le téléphone, puis envoyées toutes seules dès que le réseau
                revient.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-brand-strong">
                <Smartphone aria-hidden className="size-8" />
              </span>
              <h2 className="text-3xl font-extrabold">Comme une application</h2>
              <p className="text-lg">
                Ajoutez Nagaw Business à l’écran d’accueil de votre téléphone.
                Rien à télécharger dans un magasin d’applications.
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="steps-title"
          className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14"
        >
          <h2 id="steps-title" className="text-3xl font-extrabold">
            Prêt en trois étapes
          </h2>
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

        <section
          id="tarifs"
          aria-labelledby="pricing-title"
          className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-14"
        >
          <div className="flex flex-col gap-2">
            <h2 id="pricing-title" className="text-3xl font-extrabold">
              Tarifs
            </h2>
            <p className="text-lg text-ink-muted">
              Par boutique et par mois. Toutes les offres donnent accès à toute
              l’application ; seules les limites changent.
            </p>
          </div>
          <Suspense
            fallback={
              <p role="status" className="text-ink-muted">
                Chargement des tarifs…
              </p>
            }
          >
            <Pricing />
          </Suspense>
          <p className="text-base text-ink-muted">
            Chaque boutique commence avec l’offre gratuite. Vous changez d’offre
            depuis Paramètres, Abonnement : le paiement en ligne n’est pas
            encore ouvert, l’équipe Nagaw vous contacte pour le règlement.
          </p>
        </section>

        <section className="px-4 pb-16">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 rounded-3xl bg-sales-soft p-6 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-extrabold text-sales-ink">
                Commencez aujourd’hui
              </h2>
              <p className="text-lg text-ink">
                Votre première vente en quelques minutes.
              </p>
            </div>
            <ButtonLink href="/inscription" variant="sell" className="text-lg">
              Créer ma boutique
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <p className="mx-auto w-full max-w-6xl px-4 py-6 text-base text-ink-muted">
          Nagaw Business — la gestion de boutique, simple et en français.
        </p>
      </footer>
    </div>
  );
}
