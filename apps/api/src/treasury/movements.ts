import { sql, type RawBuilder } from 'kysely';

/**
 * Every movement of money of a shop, as rows (account_id, day, amount,
 * kind, label, source_id), the day being the calendar day in the shop's time
 * zone. Balances are always computed from it, never stored (ADR-027).
 *
 * A payment lands on the account of its kind: cash → cash drawer, Mobile
 * Money → the account of its operator, card, transfer and cheque → bank;
 * credit brings no money. A cancelled sale gives its money back the day it
 * is cancelled. Invoice payments copied from a sale are already counted.
 */
export function movementsCte(
  organizationId: string,
  timeZone: string,
): RawBuilder<unknown> {
  const accountOf = (
    method: RawBuilder<unknown>,
    provider: RawBuilder<unknown>,
  ) => sql`
    a.kind = case ${method} when 'cash' then 'cash' when 'mobile_money' then 'mobile_money' else 'bank' end
    and a.provider is not distinct from case when ${method} = 'mobile_money' then coalesce(${provider}, 'other') end`;
  return sql`
    acc as (
      select id, kind, provider, name from app.cash_accounts where organization_id = ${organizationId}
    ),
    mv as (
      select a.id as account_id, (s.occurred_at at time zone ${timeZone})::date as day,
             p.amount::bigint as amount, 'sale'::text as kind,
             lpad(s.sale_number::text, 6, '0') as label, s.id as source_id
        from app.sale_payments p
        join app.sales s on s.organization_id = p.organization_id and s.id = p.sale_id
        join acc a on ${accountOf(sql.ref('p.method'), sql.ref('p.provider'))}
       where p.organization_id = ${organizationId} and p.method <> 'credit'
      union all
      select a.id, (s.cancelled_at at time zone ${timeZone})::date, -p.amount::bigint, 'sale_cancelled',
             lpad(s.sale_number::text, 6, '0'), s.id
        from app.sale_payments p
        join app.sales s on s.organization_id = p.organization_id and s.id = p.sale_id
        join acc a on ${accountOf(sql.ref('p.method'), sql.ref('p.provider'))}
       where p.organization_id = ${organizationId} and p.method <> 'credit' and s.status = 'cancelled'
      union all
      select a.id, (r.created_at at time zone ${timeZone})::date, r.amount::bigint, 'repayment', c.name, c.id
        from app.customer_payments r
        join app.customers c on c.organization_id = r.organization_id and c.id = r.customer_id
        join acc a on ${accountOf(sql.ref('r.method'), sql.ref('r.provider'))}
       where r.organization_id = ${organizationId}
      union all
      select a.id, ip.paid_on, ip.amount::bigint, 'invoice_payment', coalesce(i.number, ''), i.id
        from app.invoice_payments ip
        join app.invoices i on i.organization_id = ip.organization_id and i.id = ip.invoice_id
        join acc a on ${accountOf(sql.ref('ip.method'), sql.ref('ip.provider'))}
       where ip.organization_id = ${organizationId} and not ip.from_sale
      union all
      select e.cash_account_id, e.occurred_on, -e.amount::bigint, 'expense', e.label, e.id
        from app.expenses e
       where e.organization_id = ${organizationId} and e.status = 'recorded'
      union all
      select t.from_account_id, t.occurred_on, -t.amount::bigint, 'transfer_out', ta.name, t.id
        from app.cash_transfers t join acc ta on ta.id = t.to_account_id
       where t.organization_id = ${organizationId}
      union all
      select t.to_account_id, t.occurred_on, t.amount::bigint, 'transfer_in', fa.name, t.id
        from app.cash_transfers t join acc fa on fa.id = t.from_account_id
       where t.organization_id = ${organizationId}
      union all
      select k.cash_account_id, k.day, k.difference::bigint, 'closing', k.note, k.id
        from app.cash_closings k
       where k.organization_id = ${organizationId} and k.difference <> 0
    )`;
}
