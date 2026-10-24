import {
  ChartColumn,
  FileText,
  Package,
  ShoppingCart,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ButtonLink } from '@/components/ui/button-link';
import { fetchApiHealth } from '@/lib/api-health';
import { apiBaseUrl, apiProtectionBypass } from '@/lib/env';

async function ApiStatus() {
  await connection();
  const health = await fetchApiHealth(
    apiBaseUrl(),
    fetch,
    3000,
    apiProtectionBypass(),
  );

  if (health.state === 'not_configured') {
    return (
      <p role="status" className="font-semibold text-warning-ink">
        API non configurée : la variable <code>API_URL</code> est absente.
      </p>
    );
  }
  if (health.state === 'down') {
    return (
      <p role="status" className="font-semibold text-danger-ink">
        API indisponible — {health.reason}
      </p>
    );
  }
  return (
    <p role="status" className="font-semibold text-sales-ink">
      API opérationnelle — version {health.data.version}, environnement{' '}
      {health.data.environment}
    </p>
  );
}

// What the product is for. Shown as upcoming: none of these modules exists
// yet, and the page says so (no feature presented as available).
const MODULES: { label: string; icon: LucideIcon; className: string }[] = [
  {
    label: 'Produits et stock',
    icon: Package,
    className: 'bg-stock-soft text-stock-ink',
  },
  {
    label: 'Ventes',
    icon: ShoppingCart,
    className: 'bg-sales-soft text-sales-ink',
  },
  {
    label: 'Factures et devis',
    icon: FileText,
    className: 'bg-invoices-soft text-invoices-ink',
  },
  {
    label: 'Chiffre d’affaires et trésorerie',
    icon: ChartColumn,
    className: 'bg-stats-soft text-stats-ink',
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-12">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-brand-ink md:text-5xl">
          Nagaw Business
        </h1>
        <p className="text-xl font-semibold">
          Gérez votre boutique depuis votre téléphone, même sans connexion.
        </p>
        <p className="text-ink-muted">
          Nagaw Business est en construction. Aujourd’hui : votre compte, vos
          boutiques et votre équipe. Les modules ci-dessous arrivent dans les
          prochaines versions.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/inscription">Créer un compte</ButtonLink>
          <ButtonLink href="/connexion" variant="secondary">
            Se connecter
          </ButtonLink>
        </div>
      </div>

      <section aria-labelledby="modules-title" className="flex flex-col gap-3">
        <h2 id="modules-title" className="text-xl font-bold">
          Bientôt disponible
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MODULES.map(({ label, icon: Icon, className }) => (
            <li
              key={label}
              className={`flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 text-lg font-bold ${className}`}
            >
              <Icon aria-hidden className="size-7 shrink-0" />
              {label}
            </li>
          ))}
          <li className="flex min-h-16 items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-lg font-bold text-brand-ink sm:col-span-2">
            <WifiOff aria-hidden className="size-7 shrink-0" />
            Vente sans connexion, envoyée dès le retour du réseau
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="status-title"
        className="rounded-2xl border border-line bg-surface p-4"
      >
        <h2 id="status-title" className="mb-2 text-lg font-bold">
          État des services
        </h2>
        <Suspense fallback={<p role="status">Vérification de l&apos;API…</p>}>
          <ApiStatus />
        </Suspense>
      </section>
    </main>
  );
}
