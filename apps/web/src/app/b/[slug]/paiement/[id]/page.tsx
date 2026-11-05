import { formatAmount, type PublicOrderStatusDto } from '@nagaw/shared';
import { CircleCheck, Clock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';
import { PageFallback } from '@/components/ui/page-fallback';
import { apiPublic } from '@/lib/api/server';
import { WavePayButton } from '../../wave-pay-button';

export const metadata: Metadata = {
  title: 'Paiement — Nagaw Business',
  robots: { index: false, follow: false },
};

/**
 * Where Wave sends the customer back (ADR-065). The page asks the API,
 * which asks Wave: being sent here proves nothing by itself.
 */
async function Payment({
  params,
  searchParams,
}: PageProps<'/b/[slug]/paiement/[id]'>) {
  const { slug, id } = await params;
  const failed = (await searchParams).echec === '1';
  const status = await apiPublic<PublicOrderStatusDto>(
    `/public/shops/${encodeURIComponent(slug)}/orders/${encodeURIComponent(id)}`,
  );
  if (!status.ok && status.status === 404) notFound();
  if (!status.ok)
    return (
      <Alert tone="error">
        Impossible de vérifier le paiement pour l’instant : {status.message}{' '}
        Réessayez dans un moment.
      </Alert>
    );
  const order = status.data;
  const amount = formatAmount(order.total, order.currency);

  if (order.paid)
    return (
      <section
        aria-labelledby="paid-title"
        className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm"
      >
        <h1
          id="paid-title"
          className="flex items-center gap-2 text-2xl font-bold"
        >
          <CircleCheck aria-hidden className="size-8 text-sales-strong" />
          Paiement reçu
        </h1>
        <p className="text-base">
          {order.shopName} a bien reçu {amount} pour la commande{' '}
          <span className="font-bold">{order.reference}</span>. La boutique vous
          recontacte pour la livraison.
        </p>
      </section>
    );

  return (
    <section
      aria-labelledby="pending-title"
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm"
    >
      <h1
        id="pending-title"
        className="flex items-center gap-2 text-2xl font-bold"
      >
        <Clock aria-hidden className="size-8 text-ink-muted" />
        {failed || order.wave === 'failed'
          ? 'Le paiement n’a pas abouti'
          : 'Paiement pas encore reçu'}
      </h1>
      <p className="text-base">
        Commande <span className="font-bold">{order.reference}</span> de{' '}
        {amount} chez {order.shopName}.
        {order.wave === 'open' &&
          ' Si vous venez de payer, attendez quelques secondes puis vérifiez.'}
      </p>
      <WavePayButton slug={slug} orderId={id} />
      <Link
        href={`/b/${slug}/paiement/${id}`}
        className={buttonClasses('secondary')}
      >
        Vérifier à nouveau
      </Link>
    </section>
  );
}

export default function PaymentPage(
  props: PageProps<'/b/[slug]/paiement/[id]'>,
) {
  return (
    <main
      id="contenu"
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 bg-canvas px-4 pt-6 pb-16"
    >
      <Suspense fallback={<PageFallback />}>
        <Payment {...props} />
      </Suspense>
    </main>
  );
}
