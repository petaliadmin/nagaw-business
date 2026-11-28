import {
  formatAmount,
  ORDER_STATUS_LABELS,
  type PublicTrackingDto,
} from '@nagaw/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageFallback } from '@/components/ui/page-fallback';
import { apiPublic } from '@/lib/api/server';
import { formatCalendarDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Suivi de ma commande',
  robots: { index: false, follow: false },
};

const STEPS = [
  {
    key: 'sent',
    title: 'Envoyée',
    text: 'Votre commande est arrivée à la boutique.',
  },
  {
    key: 'to_confirm',
    title: 'À confirmer par la boutique',
    text: 'En attente de sa réponse.',
  },
  {
    key: 'ready',
    title: 'Acceptée, en préparation',
    text: 'La boutique vous préviendra quand c’est prêt.',
  },
  { key: 'delivered', title: 'Remise', text: 'Vous payez sur place.' },
] as const;

/** Where the order is, step by step (index of the current one). */
function stepOf(status: PublicTrackingDto['status']): number {
  if (status === 'to_confirm') return 1;
  if (status === 'delivered') return 3;
  return 2;
}

async function Tracking({ params }: PageProps<'/b/[adresse]/suivi/[jeton]'>) {
  const { adresse, jeton } = await params;
  const result = await apiPublic<PublicTrackingDto>(
    `/public/storefronts/${encodeURIComponent(adresse)}/tracking/${encodeURIComponent(jeton)}`,
  );
  if (!result.ok && result.status === 404) notFound();
  if (!result.ok)
    return (
      <main className="mx-auto max-w-2xl p-6 text-center">
        <h1 className="text-2xl font-black">
          Suivi momentanément indisponible
        </h1>
        <p className="text-ink-muted">Réessayez dans un instant.</p>
      </main>
    );
  const order = result.data;
  const money = (value: number) => formatAmount(value, order.currency);
  const current = stepOf(order.status);
  const declined = order.status === 'cancelled';
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-6">
      <p className="flex items-center gap-2 text-lg font-extrabold">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-sm font-black text-brand-ink"
        >
          {order.shopName.slice(0, 2).toUpperCase()}
        </span>
        {order.shopName}
      </p>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black">
          {order.firstName
            ? `${order.firstName}, votre commande`
            : 'Votre commande'}
        </h1>
        <p className="text-ink-muted tabular-nums">
          {order.number} · {ORDER_STATUS_LABELS[order.status]}
        </p>
      </div>

      {declined ? (
        <p
          role="status"
          className="rounded-3xl bg-warning-soft p-4 font-bold text-warning-ink"
        >
          La boutique n’a pas pu accepter cette commande
          {order.declineReason ? ` : ${order.declineReason}` : '.'}
        </p>
      ) : (
        <ol className="flex flex-col">
          {STEPS.map((step, index) => {
            const done = index < current;
            const now = index === current;
            return (
              <li key={step.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    aria-hidden
                    className={`mt-0.5 size-5 rounded-full ${done ? 'bg-sales-strong' : now ? 'border-[5px] border-brand-strong bg-canvas' : 'border-2 border-line-strong bg-canvas'}`}
                  />
                  {index < STEPS.length - 1 && (
                    <span aria-hidden className="w-0.5 flex-1 bg-line" />
                  )}
                </div>
                <div className="pb-5">
                  <p
                    className={
                      now || done
                        ? 'font-extrabold'
                        : 'font-semibold text-ink-muted'
                    }
                  >
                    {step.title}
                    <span className="sr-only">
                      {done
                        ? ' (fait)'
                        : now
                          ? ' (étape en cours)'
                          : ' (à venir)'}
                    </span>
                  </p>
                  <p className="text-sm text-ink-muted">{step.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <section
        aria-labelledby="h-detail"
        className="flex flex-col gap-2 rounded-3xl bg-surface p-4"
      >
        <h2 id="h-detail" className="font-extrabold">
          Détail
        </h2>
        <ul className="flex flex-col gap-1">
          {order.lines.map((line, index) => (
            <li key={index} className="flex justify-between gap-3">
              <span>
                {line.label} × {String(line.quantity).replace('.', ',')}
              </span>
              <span className="tabular-nums">
                {line.lineTotal === null
                  ? 'Prix à venir'
                  : money(line.lineTotal)}
              </span>
            </li>
          ))}
        </ul>
        <p className="flex items-baseline justify-between border-t border-line pt-2">
          <span className="font-bold">Total</span>
          <span className="text-xl font-black text-sales-ink tabular-nums">
            {money(order.itemsTotal)}
            {order.pricesToCome ? ' +' : ''}
          </span>
        </p>
        <p className="text-sm text-ink-muted">
          Retrait le {formatCalendarDate(order.dueOn)}
          {order.dueTime ? ` vers ${order.dueTime}` : ''} à la boutique
          {order.landmark ? `, ${order.landmark}` : ''}. Paiement sur place.
        </p>
      </section>

      {order.whatsapp && (
        <a
          href={`https://wa.me/${order.whatsapp}?text=${encodeURIComponent(`Bonjour, au sujet de ma commande ${order.number}.`)}`}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-14 items-center justify-center rounded-full bg-ink text-lg font-extrabold text-canvas"
        >
          Écrire à la boutique
        </a>
      )}
      {order.slug && (
        <a
          href={`/b/${order.slug}`}
          className="min-h-12 text-center font-bold text-brand-ink underline"
        >
          Revoir la vitrine
        </a>
      )}
    </main>
  );
}

export default function TrackingPage(
  props: PageProps<'/b/[adresse]/suivi/[jeton]'>,
) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Tracking {...props} />
    </Suspense>
  );
}
