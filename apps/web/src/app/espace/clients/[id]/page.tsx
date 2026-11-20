import {
  formatAmount,
  roleHasPermission,
  type CustomerDetailDto,
} from '@nagaw/shared';
import { FilePlus2, FileText, HandCoins, Pencil, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { buttonClasses } from '@/components/ui/button-styles';
import { Card } from '@/components/ui/card';
import { Figure } from '@/components/ui/figure';
import { EmptyState } from '@/components/ui/empty-state';
import { PageFallback } from '@/components/ui/page-fallback';
import { PageHeader } from '@/components/ui/page-header';
import { apiAsUser } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { PAYMENT_LABELS, ticketNumber } from '@/lib/sales/labels';
import { creditReminderText } from '@/lib/sales/ticket';
import { requireReadyWorkspace } from '@/lib/workspace/load';
import { ReminderComposer } from './reminder-composer';
import {
  ContactAvatar,
  SaveContactButton,
} from '@/components/contacts/contact-actions';
import { CustomerForm, RepaymentForm } from '../customer-forms';

export const metadata: Metadata = { title: 'Client — Nagaw Business' };

async function Customer({ params }: PageProps<'/espace/clients/[id]'>) {
  const workspace = await requireReadyWorkspace();
  if (!workspace) return null;
  const { organization, accessToken } = workspace;
  const { id } = await params;
  const customer = await apiAsUser<CustomerDetailDto>(accessToken, {
    path: `/customers/${encodeURIComponent(id)}`,
    organizationId: organization.id,
  });
  if (!customer.ok && customer.status === 404) notFound();
  if (!customer.ok)
    return <Alert tone="error">Client indisponible : {customer.message}</Alert>;
  const c = customer.data;
  const currency = organization.defaultCurrency;
  const money = (value: number) => formatAmount(value, currency);
  const canManage = roleHasPermission(organization.role, 'customers.manage');
  const canDocument = roleHasPermission(organization.role, 'documents.manage');

  return (
    <>
      <div className="flex items-center gap-4">
        <ContactAvatar person={c} size="size-16 text-2xl" />
        <div className="min-w-0 flex-1">
          <PageHeader title={c.name} description={c.notes || undefined} />
        </div>
      </div>
      {/* The actions in one row of short pills, like the header of a chat
          (ADR-063); each keeps its full name for screen readers. */}
      {(c.phone || canDocument) && (
        <div className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {c.phone && (
            <a
              href={`tel:${c.phone.replace(/\s/g, '')}`}
              className={buttonClasses('secondary', 'shrink-0')}
            >
              <Phone aria-hidden className="size-5" />
              Appeler<span className="sr-only"> le {c.phone}</span>
            </a>
          )}
          {c.phone && (
            <SaveContactButton
              person={c}
              countryCode={organization.phoneCountryCode}
            />
          )}
          {canDocument && (
            <>
              <ButtonLink
                href={`/espace/factures/nouvelle?client=${c.id}`}
                variant="secondary"
                className="shrink-0"
              >
                <FilePlus2 aria-hidden className="size-5" />
                <span className="sr-only">Faire une </span>Facture
              </ButtonLink>
              <ButtonLink
                href={`/espace/factures/devis/nouveau?client=${c.id}`}
                variant="secondary"
                className="shrink-0"
              >
                <FileText aria-hidden className="size-5" />
                <span className="sr-only">Faire un </span>Devis
              </ButtonLink>
            </>
          )}
        </div>
      )}

      <section
        aria-labelledby="balance-title"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-3xl bg-surface px-5 py-4"
      >
        <h2 id="balance-title" className="text-sm font-bold text-ink-muted">
          {c.balance > 0 ? 'Reste à payer' : 'Ce que le client doit'}
        </h2>
        <div
          className={`@container min-w-40 flex-1 text-right font-extrabold tabular-nums [--figure-max:1.75rem] ${c.balance > 0 ? 'text-warning-ink' : 'text-sales-ink'}`}
        >
          <Figure value={money(c.balance)} />
        </div>
        {c.creditLimit !== null && (
          <p className="basis-full text-ink-muted">
            Crédit maximum : {money(c.creditLimit)}
          </p>
        )}
      </section>

      {/* The credit as a conversation (ADR-063): what the customer took on
          the left, what he paid back on the right, oldest first. */}
      <section aria-labelledby="activity" className="flex flex-col gap-3">
        <h2 id="activity" className="text-lg font-extrabold">
          Achats à crédit et remboursements
        </h2>
        {c.activity.length === 0 ? (
          <EmptyState title="Rien pour le moment" />
        ) : (
          <ol
            aria-label="Historique du client"
            className="flex flex-col gap-2 rounded-3xl bg-surface p-3"
          >
            {[...c.activity].reverse().map((entry) => {
              const sale = entry.kind === 'credit_sale';
              return (
                <li
                  key={`${entry.kind}-${entry.id}`}
                  className={`flex max-w-[85%] flex-col gap-1 px-4 py-3 ${
                    sale
                      ? 'self-start rounded-[1.25rem] rounded-tl-md bg-canvas'
                      : 'self-end rounded-[1.25rem] rounded-tr-md bg-sales-soft'
                  }`}
                >
                  {sale ? (
                    <Link
                      href={`/espace/ventes/${entry.id}`}
                      className="inline-flex min-h-12 items-center font-bold text-warning-ink underline underline-offset-4"
                    >
                      Achat à crédit, ticket{' '}
                      {ticketNumber(entry.saleNumber ?? 0)}
                    </Link>
                  ) : (
                    <span className="font-bold text-sales-ink">
                      Remboursement
                      {entry.method ? ` · ${PAYMENT_LABELS[entry.method]}` : ''}
                    </span>
                  )}
                  <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="text-lg font-extrabold tabular-nums">
                      {sale ? '+' : '−'}
                      {money(entry.amount)}
                    </span>
                    <span className="text-sm text-ink-muted">
                      {formatDateTime(entry.at, organization.timezone)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {canManage &&
          c.balance > 0 &&
          (c.phone ? (
            <ReminderComposer
              text={creditReminderText(
                c.name,
                organization.name,
                money(c.balance),
              )}
              phone={c.phone}
              countryCode={organization.phoneCountryCode}
              customerName={c.name}
            />
          ) : (
            <p className="text-ink-muted">
              Ajoutez son numéro pour le relancer sur WhatsApp.
            </p>
          ))}
      </section>

      {canManage && c.balance > 0 && (
        <Card title="Il a payé" titleId="repay" icon={HandCoins} tone="sales">
          <RepaymentForm
            organizationId={organization.id}
            currency={currency}
            customer={c}
          />
        </Card>
      )}

      {canManage && (
        <Card title="Modifier le client" titleId="edit-customer" icon={Pencil}>
          <CustomerForm
            organizationId={organization.id}
            currency={currency}
            customer={c}
          />
        </Card>
      )}
    </>
  );
}

export default function CustomerPage(props: PageProps<'/espace/clients/[id]'>) {
  return (
    <Suspense fallback={<PageFallback variant="detail" />}>
      <Customer {...props} />
    </Suspense>
  );
}
