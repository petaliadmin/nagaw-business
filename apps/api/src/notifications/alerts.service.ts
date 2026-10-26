import { Injectable, Logger } from '@nestjs/common';
import { formatAmount, type Unit } from '@nagaw/shared';
import type { Executor } from '../catalog/catalog.errors.js';
import { NotificationsService } from './notifications.service.js';
import { PushService } from './push.service.js';
import {
  addToTally,
  appendLine,
  formatQuantity,
  nearCreditLimit,
  stockCrossing,
} from './rules.js';

/** Longest a request waits for push services after its work is saved. */
const FLUSH_BUDGET_MS = 5000;

export interface StockChange {
  productId: string;
  name: string;
  unit: Unit;
  threshold: number | null;
  before: number;
  after: number;
}

interface Shop {
  timezone: string;
  currency: string;
  /** Local day, YYYY-MM-DD: groups « of the day » change at midnight. */
  day: string;
}

async function shopOf(trx: Executor, organizationId: string): Promise<Shop> {
  const row = await trx
    .selectFrom('app.organizations')
    .select(['timezone', 'default_currency'])
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow();
  return {
    timezone: row.timezone,
    currency: row.default_currency,
    day: new Intl.DateTimeFormat('en-CA', { timeZone: row.timezone }).format(
      new Date(),
    ),
  };
}

/** « vente » / « ventes ». */
const plural = (count: number, word: string, many = `${word}s`) =>
  `${count} ${count > 1 ? many : word}`;

/**
 * What the shop's events mean for its people (ADR-036). Every method runs
 * in the transaction of the event it tells; `flush` sends the push
 * messages once that transaction has committed.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
  ) {}

  /** Low or out of stock, told once when the line is crossed. */
  async stockChanged(
    trx: Executor,
    organizationId: string,
    changes: readonly StockChange[],
  ): Promise<void> {
    for (const change of changes) {
      const crossing = stockCrossing(
        change.before,
        change.after,
        change.threshold,
      );
      if (!crossing) continue;
      await this.notifications.notify(trx, {
        organizationId,
        category: 'stock',
        kind: crossing === 'out' ? 'stock.out' : 'stock.low',
        severity: crossing === 'out' ? 'danger' : 'warning',
        title:
          crossing === 'out'
            ? `${change.name} : épuisé`
            : `${change.name} : bientôt épuisé`,
        body:
          crossing === 'out'
            ? 'Il n’en reste plus. Pensez à en racheter.'
            : `Il reste ${formatQuantity(Math.max(change.after, 0), change.unit)}. Pensez à en racheter.`,
        link: `/espace/produits/${change.productId}`,
        groupKey: `stock:${change.productId}`,
        data: { productId: change.productId, stock: change.after },
      });
    }
  }

  async saleRecorded(
    trx: Executor,
    sale: {
      organizationId: string;
      id: string;
      saleNumber: number;
      deviceTicket: string | null;
      total: number;
      credit: number;
      sellerId: string;
      sellerEmail: string;
      priceReview: boolean;
      /** Lines that took more than the stock the server knew. */
      shortages: { name: string; unit: Unit; sold: number; stock: number }[];
      customer: {
        id: string;
        name: string;
        balanceBefore: number;
        limit: number | null;
      } | null;
      nearLimitPercent: number;
    },
  ): Promise<void> {
    const shop = await shopOf(trx, sale.organizationId);
    const money = (value: number) => formatAmount(value, shop.currency);
    const ticket = sale.deviceTicket ? ` (ticket ${sale.deviceTicket})` : '';

    // A sale to look at: prices or stock did not match.
    const reasons: string[] = [];
    if (sale.priceReview)
      reasons.push('vendue hors ligne à des prix différents du catalogue');
    for (const s of sale.shortages)
      reasons.push(
        `${formatQuantity(s.sold, s.unit)} de ${s.name} vendus pour ${formatQuantity(Math.max(s.stock, 0), s.unit)} en stock`,
      );
    if (reasons.length > 0)
      await this.notifications.notify(trx, {
        organizationId: sale.organizationId,
        category: 'controls',
        kind: 'sale.review',
        severity: 'warning',
        title: `Vente n° ${sale.saleNumber} à vérifier`,
        body: `Par ${sale.sellerEmail}${ticket} : ${reasons.join(' ; ')}.`,
        link: `/espace/ventes/${sale.id}`,
        groupKey: `sale-review:${sale.id}`,
        data: { saleId: sale.id },
        exceptUserId: sale.sellerId,
      });

    if (
      sale.customer &&
      sale.credit > 0 &&
      nearCreditLimit(
        sale.customer.balanceBefore,
        sale.customer.balanceBefore + sale.credit,
        sale.customer.limit,
        sale.nearLimitPercent,
      )
    )
      await this.notifications.notify(trx, {
        organizationId: sale.organizationId,
        category: 'credit',
        kind: 'credit.near_limit',
        severity: 'warning',
        title: `${sale.customer.name} approche de son plafond`,
        body: `Doit maintenant ${money(sale.customer.balanceBefore + sale.credit)} sur ${money(sale.customer.limit ?? 0)} autorisés.`,
        link: `/espace/clients/${sale.customer.id}`,
        groupKey: `credit-limit:${sale.customer.id}`,
        data: { customerId: sale.customer.id },
        exceptUserId: sale.sellerId,
      });

    // The owner's view of the day, one notification updated sale by sale.
    await this.notifications.notify(trx, {
      organizationId: sale.organizationId,
      category: 'activity',
      kind: 'activity.sales',
      title: 'Ventes du jour',
      link: '/espace/ventes',
      groupKey: `activity-sales:${shop.day}`,
      exceptUserId: sale.sellerId,
      merge: (previous) => {
        const tally = addToTally(previous?.tally, sale.total);
        return {
          title: `${plural(tally.count, 'vente')} aujourd’hui : ${money(tally.total)}`,
          body: `Dernière : n° ${sale.saleNumber}, ${money(sale.total)}, par ${sale.sellerEmail}.`,
          data: { tally },
        };
      },
    });
  }

  /** A seller changed the stock at the counter: the managers are told. */
  async stockCorrected(
    trx: Executor,
    event: {
      organizationId: string;
      productId: string;
      name: string;
      unit: Unit;
      quantity: number;
      counted: number;
      reason: string;
      userId: string;
      userEmail: string;
    },
  ): Promise<void> {
    const shop = await shopOf(trx, event.organizationId);
    const sign = event.quantity > 0 ? '+' : '−';
    const line = `${event.name} : ${sign}${formatQuantity(Math.abs(event.quantity), event.unit)} (compté ${formatQuantity(event.counted, event.unit)}) par ${event.userEmail} — ${event.reason}`;
    await this.notifications.notify(trx, {
      organizationId: event.organizationId,
      category: 'controls',
      kind: 'stock.corrected',
      severity: 'warning',
      title: 'Stock corrigé à la caisse',
      link: `/espace/produits/${event.productId}`,
      groupKey: `stock-corrections:${shop.day}`,
      exceptUserId: event.userId,
      merge: (previous) => {
        const lines = appendLine(previous?.lines, line);
        const count = (Number(previous?.count) || 0) + 1;
        return {
          title:
            count > 1
              ? `${count} corrections de stock à la caisse aujourd’hui`
              : 'Stock corrigé à la caisse',
          body: lines.join('\n'),
          data: { lines, count },
        };
      },
    });
  }

  /** A seller recorded a delivery: the managers see it the same day. */
  async goodsReceived(
    trx: Executor,
    event: {
      organizationId: string;
      productId: string;
      name: string;
      unit: Unit;
      quantity: number;
      userId: string;
      userEmail: string;
    },
  ): Promise<void> {
    const shop = await shopOf(trx, event.organizationId);
    const line = `${event.name} : +${formatQuantity(event.quantity, event.unit)} par ${event.userEmail}`;
    await this.notifications.notify(trx, {
      organizationId: event.organizationId,
      category: 'controls',
      kind: 'stock.received',
      title: 'Marchandise reçue',
      link: `/espace/produits/${event.productId}`,
      groupKey: `stock-received:${shop.day}`,
      exceptUserId: event.userId,
      merge: (previous) => {
        const lines = appendLine(previous?.lines, line);
        const count = (Number(previous?.count) || 0) + 1;
        return {
          title:
            count > 1
              ? `${count} entrées de marchandise aujourd’hui`
              : 'Marchandise reçue',
          body: lines.join('\n'),
          data: { lines, count },
        };
      },
    });
  }

  /** Operations a phone sent and the server refused. */
  async syncRejected(
    trx: Executor,
    event: {
      organizationId: string;
      userId: string;
      userEmail: string;
      rejections: { label: string; message: string }[];
    },
  ): Promise<void> {
    if (event.rejections.length === 0) return;
    const shop = await shopOf(trx, event.organizationId);
    await this.notifications.notify(trx, {
      organizationId: event.organizationId,
      category: 'controls',
      kind: 'sync.rejected',
      severity: 'danger',
      title: 'Opération refusée',
      link: '/espace/ventes',
      groupKey: `sync-rejected:${shop.day}`,
      exceptUserId: event.userId,
      merge: (previous) => {
        let lines = Array.isArray(previous?.lines) ? previous.lines : [];
        for (const r of event.rejections)
          lines = appendLine(
            lines,
            `${r.label} (${event.userEmail}) : ${r.message}`,
          );
        const count = (Number(previous?.count) || 0) + event.rejections.length;
        return {
          title:
            count > 1
              ? `${count} opérations refusées aujourd’hui`
              : 'Opération refusée',
          body: lines.join('\n'),
          data: { lines, count },
        };
      },
    });
  }

  async expenseRecorded(
    trx: Executor,
    event: {
      organizationId: string;
      label: string;
      amount: number;
      userId: string;
    },
  ): Promise<void> {
    const shop = await shopOf(trx, event.organizationId);
    const money = (value: number) => formatAmount(value, shop.currency);
    await this.notifications.notify(trx, {
      organizationId: event.organizationId,
      category: 'activity',
      kind: 'activity.expenses',
      title: 'Dépenses du jour',
      link: '/espace/tresorerie/depenses',
      groupKey: `activity-expenses:${shop.day}`,
      exceptUserId: event.userId,
      merge: (previous) => {
        const tally = addToTally(previous?.tally, event.amount);
        return {
          title: `${plural(tally.count, 'dépense')} aujourd’hui : ${money(tally.total)}`,
          body: `Dernière : ${event.label}, ${money(event.amount)}.`,
          data: { tally },
        };
      },
    });
  }

  async invoiceIssued(
    trx: Executor,
    event: {
      organizationId: string;
      invoiceId: string;
      number: string;
      customerName: string;
      total: number;
      userId: string;
    },
  ): Promise<void> {
    const shop = await shopOf(trx, event.organizationId);
    const money = (value: number) => formatAmount(value, shop.currency);
    await this.notifications.notify(trx, {
      organizationId: event.organizationId,
      category: 'activity',
      kind: 'activity.invoices',
      title: 'Factures du jour',
      link: `/espace/factures/${event.invoiceId}`,
      groupKey: `activity-invoices:${shop.day}`,
      exceptUserId: event.userId,
      merge: (previous) => {
        const tally = addToTally(previous?.tally, event.total);
        return {
          title: `${plural(tally.count, 'facture')} aujourd’hui : ${money(tally.total)}`,
          body: `Dernière : ${event.number} pour ${event.customerName}, ${money(event.total)}.`,
          data: { tally },
        };
      },
    });
  }

  /**
   * Sends what the committed work produced, within a short budget: a slow
   * push service never delays the answer for long, and what is not sent
   * now is sent by the next call or the daily run.
   */
  async flush(organizationId: string): Promise<void> {
    if (!this.push.enabled) return;
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.push.dispatchPending(organizationId),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, FLUSH_BUDGET_MS);
        }),
      ]);
    } catch (error) {
      this.logger.error(
        { err: error },
        'Envoi des notifications push impossible',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
