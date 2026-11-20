import { ArrowRight, Check, ChevronDown, CircleCheck } from 'lucide-react';
import { formatAmount, type PlanDto } from '@nagaw/shared';
import type { Metadata } from 'next';
import Image from 'next/image';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ArticleCard } from '@/components/blog/article-card';
import { JsonLd } from '@/components/json-ld';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { WhatsAppButton } from '@/components/marketing/whatsapp-button';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
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

const TITLE = 'Nagaw Business — qui vous doit, ce que vous gagnez';
const DESCRIPTION =
  'Sachez qui vous doit, relancez sur WhatsApp et voyez ce que vous gagnez vraiment, depuis votre téléphone : caisse qui marche sans internet, stock, Wave et Orange Money, factures. Gratuit pour commencer.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'logiciel de gestion de boutique',
    'application de caisse',
    'logiciel de caisse gratuit',
    'crédit clients',
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

/** The ways to pay that the checkout takes, as its buttons name them. */
const PAYMENT_WAYS = [
  { label: 'Espèces', tone: 'bg-sales-soft text-sales-ink' },
  { label: 'Wave', tone: 'bg-stock-soft text-stock-ink' },
  { label: 'Orange Money', tone: 'bg-stats-soft text-stats-ink' },
  { label: 'Free Money', tone: 'bg-accounting-soft text-accounting-ink' },
  { label: 'Carte', tone: 'bg-brand-soft text-brand-ink' },
  { label: 'Crédit', tone: 'bg-warning-soft text-warning-ink' },
] as const;

/**
 * What a shopkeeper does every day, each in three touches (ADR-062). The
 * words are those of the buttons of the application.
 */
const GESTURES = [
  {
    title: 'Encaisser',
    steps: [
      'Touchez « Caisse » puis les produits',
      'Choisissez Espèces, Wave ou Orange Money',
      'Envoyez le reçu sur WhatsApp',
    ],
    text: 'Le stock et la caisse se mettent à jour tout seuls, même sans internet.',
    tone: { card: 'bg-sales-soft', ink: 'text-sales-ink' },
  },
  {
    title: 'Récupérer un crédit',
    steps: [
      'Ouvrez « Ils vous doivent »',
      'Le message poli est déjà écrit',
      'Touchez Envoyer',
    ],
    text: 'Le message poli est déjà écrit pour vous.',
    tone: { card: 'bg-warning-soft', ink: 'text-warning-ink' },
  },
  {
    title: 'Clôturer la journée',
    steps: [
      'Touchez « Clôturer la journée »',
      'Comptez votre argent',
      'Voyez s’il manque quelque chose',
    ],
    text: 'Caisse, Wave, Orange Money : chaque solde à part.',
    tone: { card: 'bg-brand-soft', ink: 'text-brand-ink' },
  },
] as const;

const STEPS = [
  {
    title: 'Créez votre compte',
    text: 'Votre numéro de téléphone et un code secret de 4 chiffres, puis le nom de votre boutique. Deux minutes.',
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
      'L’offre gratuite permet de commencer sans payer et sans carte bancaire. Une offre payante se demande depuis l’application, qui vous indique le montant, le numéro Wave et la référence à donner. L’offre change dès que le paiement est reçu.',
  },
  {
    question: 'Mes vendeurs peuvent-ils l’utiliser ?',
    answer:
      'Oui. Créez pour chacun un lien d’invitation et envoyez-le, par WhatsApp par exemple. Un vendeur encaisse et voit ses ventes. L’argent, les chiffres et les factures restent réservés au propriétaire et aux gérants, et tout est noté dans l’historique.',
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
const SCREENS_DIR = '/screens/2026-11-18';
const screen = (device: Device, name: string) =>
  `${SCREENS_DIR}/${device}/${name}.png`;

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
                  <p className="text-sm text-ink-muted">
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
                {free ? 'Créer ma boutique gratuitement' : 'Créer ma boutique'}
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
        <section>
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1fr_1.2fr] md:py-20">
            <div className="flex flex-col gap-5">
              <p className="text-base font-bold tracking-wide text-brand-ink uppercase">
                Le crédit, la caisse et le stock de votre boutique
              </p>
              <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
                Votre boutique dans votre téléphone. Simple comme envoyer un
                message.
              </h1>
              <p className="text-xl text-ink-muted">
                Encaissez en espèces, Wave ou Orange Money, relancez ceux qui
                vous doivent sur WhatsApp et sachez ce que vous gagnez.{' '}
                <strong className="text-ink">
                  Même quand le réseau coupe.
                </strong>
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ButtonLink
                  href="/inscription"
                  variant="sell"
                  className="min-h-14 text-lg whitespace-nowrap"
                >
                  Créer ma boutique gratuitement
                  <ArrowRight aria-hidden className="size-5" />
                </ButtonLink>
                {/* A plain link: one main action, and nothing under the
                    floating WhatsApp button on a phone. */}
                <a
                  href="#tarifs"
                  className="inline-flex min-h-12 items-center self-start font-bold text-brand-ink underline underline-offset-4"
                >
                  Voir les tarifs
                </a>
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
                alt="Tableau de bord sur ordinateur : barre latérale blanche avec le bouton Caisse en haut, carte sombre « Ventes · ce mois · 7 ventes » à 350 500 F CFA, 53 000 F CFA gagnés, 15 000 F CFA de dépenses, et les raccourcis ronds."
                priority
                className="hidden md:block"
              />
              <PhoneScreen
                src={screen('mobile', 'accueil')}
                alt="Tableau de bord sur téléphone : carte sombre des ventes du mois à 350 500 F CFA avec le bouton Masquer, quatre raccourcis ronds, « Ils vous doivent · 52 000 F CFA », et le bouton Caisse au milieu de la barre du bas."
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

        {/* How customers pay: the words of the checkout (ADR-063). */}
        <section aria-labelledby="pay-title" className="border-b border-line">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 md:flex-row md:items-center">
            <h2 id="pay-title" className="shrink-0 text-lg font-bold">
              Vos clients paient comme ils veulent :
            </h2>
            <ul className="flex flex-wrap gap-2">
              {PAYMENT_WAYS.map(({ label, tone }) => (
                <li
                  key={label}
                  className={`rounded-full px-4 py-2 font-bold ${tone}`}
                >
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Three touches for a result (ADR-062): the three things a
            shopkeeper does every day, each in three steps. */}
        <section
          id="fonctions"
          aria-labelledby="gestures-title"
          className="border-y border-line bg-surface"
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-14">
            <SectionTitle
              id="gestures-title"
              title="Trois gestes, et c’est fait"
              text="De grands boutons, des mots simples. Rien à apprendre."
            />
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {GESTURES.map(({ title, steps, text, tone }) => (
                <li
                  key={title}
                  className={`flex flex-col gap-4 rounded-3xl p-6 ${tone.card}`}
                >
                  <h3 className={`text-2xl font-extrabold ${tone.ink}`}>
                    {title}
                  </h3>
                  <ol className="flex flex-col gap-3">
                    {steps.map((step, index) => (
                      <li
                        key={step}
                        className="flex items-center gap-3 font-bold"
                      >
                        <span
                          aria-hidden
                          className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-surface font-extrabold ${tone.ink}`}
                        >
                          {index + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <p className="text-base">{text}</p>
                </li>
              ))}
            </ul>
          </div>
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
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-xl font-extrabold text-canvas">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-extrabold">{title}</h3>
                  <p className="text-sm text-ink-muted">{text}</p>
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
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-14">
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
            <p className="text-sm text-ink-muted">
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
          className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14"
        >
          <SectionTitle id="faq-title" title="Vos questions" />
          <ul className="flex flex-col gap-3">
            {FAQ.map(({ question, answer }) => (
              <li key={question}>
                <details className="group rounded-3xl bg-surface">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
                    <span className="flex-1">{question}</span>
                    <ChevronDown
                      aria-hidden
                      className="size-6 shrink-0 text-ink-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    />
                  </summary>
                  <p className="px-4 pb-4 text-sm text-ink-muted">{answer}</p>
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
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 rounded-3xl bg-sidebar p-6 text-white md:flex-row md:items-center md:justify-between md:p-10">
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
              // Violet ring on the dark band: under 3:1, white instead.
              className="shrink-0 text-lg focus-visible:outline-white"
            >
              Créer ma boutique gratuitement
            </ButtonLink>
          </div>
        </section>
      </main>

      <SiteFooter belowFloatingButton />
      <WhatsAppButton />
    </div>
  );
}
