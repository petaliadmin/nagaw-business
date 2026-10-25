import {
  formatAmount,
  formatRate,
  type DocumentCustomerDto,
  type DocumentLine,
  type DocumentTotals,
} from '@nagaw/shared';
import { formatQuantity } from '@/lib/catalog/labels';

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 ${strong ? 'text-xl font-extrabold' : ''}`}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function CustomerBlock({ customer }: { customer: DocumentCustomerDto }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-base text-ink-muted">Client</p>
      <p className="text-lg font-bold">{customer.name}</p>
      {customer.address && (
        <p className="whitespace-pre-line">{customer.address}</p>
      )}
      {customer.phone && <p>Tél. : {customer.phone}</p>}
      {customer.email && <p>{customer.email}</p>}
      {customer.taxId && <p>NINEA : {customer.taxId}</p>}
    </div>
  );
}

/** Lines and totals of a quote or an invoice, as on its PDF. */
export function DocumentBody({
  lines,
  totals,
  notes,
  currency,
  extraRows = [],
}: {
  lines: (DocumentLine & { lineTotal: number })[];
  totals: DocumentTotals;
  notes: string;
  currency: string;
  /** Paid and left to pay, for an invoice. */
  extraRows?: { label: string; value: number; strong?: boolean }[];
}) {
  const money = (value: number) => formatAmount(value, currency);
  return (
    <>
      <ul
        aria-label="Lignes du document"
        className="flex flex-col divide-y divide-line"
      >
        {lines.map((line, index) => (
          <li key={index} className="flex flex-col gap-1 py-3 first:pt-0">
            <div className="flex justify-between gap-3">
              <span className="font-semibold">{line.label}</span>
              <span className="font-bold tabular-nums">
                {money(line.lineTotal)}
              </span>
            </div>
            <span className="text-ink-muted">
              {formatQuantity(line.quantity, line.unit)} ×{' '}
              {money(line.unitPrice)}
              {line.taxRateBasisPoints
                ? ` · TVA ${formatRate(line.taxRateBasisPoints)}`
                : ''}
            </span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-1 rounded-2xl bg-invoices-soft p-4 text-invoices-ink">
        {totals.discount > 0 && (
          <>
            <Row label="Sous-total" value={money(totals.subtotal)} />
            <Row label="Remise" value={`−${money(totals.discount)}`} />
          </>
        )}
        <Row label="Total hors taxes" value={money(totals.totalExcludingTax)} />
        {totals.taxByRate.map((tax) => (
          <Row
            key={tax.rateBasisPoints}
            label={`TVA ${formatRate(tax.rateBasisPoints)}`}
            value={money(tax.amount)}
          />
        ))}
        <Row label="Total TTC" value={money(totals.total)} strong />
        {extraRows.map((row) => (
          <Row
            key={row.label}
            label={row.label}
            value={money(row.value)}
            strong={row.strong}
          />
        ))}
      </dl>
      {notes && <p className="whitespace-pre-line text-ink-muted">{notes}</p>}
    </>
  );
}
