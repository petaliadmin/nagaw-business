// Treasury and statistics part of the fake API (see fake-backend.mjs). Same
// shared schemas and rules as the real API (ADR-027): balances computed from
// what records money, payments on the account of their kind, counted days
// that no longer change.
import { randomUUID } from 'node:crypto';
import {
  accountOfPayment,
  cancelExpenseSchema,
  createClosingSchema,
  createExpenseCategorySchema,
  createExpenseSchema,
  createTransferSchema,
  movementsQuerySchema,
  PAYMENT_METHODS,
  periodQuerySchema,
  roleHasPermission,
  shareBasisPoints,
  updateCashAccountSchema,
  updateExpenseCategorySchema,
} from '@nagaw/shared';
import { catalogState } from './fake-catalog.mjs';
import { documentsState } from './fake-documents.mjs';
import { salesState } from './fake-sales.mjs';

const DEFAULT_ACCOUNTS = [
  ['cash', null, 'Caisse'],
  ['mobile_money', 'other', 'Autre Mobile Money'],
  ['mobile_money', 'free_money', 'Free Money'],
  ['mobile_money', 'orange_money', 'Orange Money'],
  ['mobile_money', 'wave', 'Wave'],
  ['bank', null, 'Banque'],
];
const DEFAULT_CATEGORIES = [
  ['Achat de marchandises', '601'],
  ['Eau et électricité', '605'],
  ['Loyer', '622'],
  ['Salaires', '66'],
  ['Autres dépenses', '658'],
];

function seed() {
  return { shops: {} };
}
let state = seed();
export function resetTreasury() {
  state = seed();
}

function shop(orgId) {
  state.shops[orgId] ??= {
    accounts: DEFAULT_ACCOUNTS.map(([kind, provider, name]) => ({
      id: randomUUID(),
      kind,
      provider,
      name,
      openingBalance: 0,
    })),
    categories: DEFAULT_CATEGORIES.map(([name, accountCode]) => ({
      id: randomUUID(),
      name,
      accountCode,
      status: 'active',
    })),
    expenses: [],
    transfers: [],
    closings: [],
  };
  return state.shops[orgId];
}

const dayIn = (iso, timeZone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(iso));
function addDays(day, n) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** Every movement of money of a shop, as the real API computes them. */
function movements(orgId, timeZone) {
  const s = shop(orgId);
  const accountFor = (method, provider) => {
    const target = accountOfPayment(method, provider ?? null);
    return target
      ? s.accounts.find(
          (a) => a.kind === target.kind && a.provider === target.provider,
        )
      : null;
  };
  const out = [];
  const sales = salesState();
  for (const sale of sales.sales.filter((x) => x.organizationId === orgId)) {
    const label = String(sale.saleNumber).padStart(6, '0');
    for (const p of sale.payments) {
      const account = accountFor(p.method, p.provider);
      if (!account) continue;
      out.push({
        accountId: account.id,
        day: dayIn(sale.occurredAt, timeZone),
        amount: p.amount,
        kind: 'sale',
        label,
        sourceId: sale.id,
      });
      if (sale.status === 'cancelled')
        out.push({
          accountId: account.id,
          day: dayIn(sale.cancellation.at, timeZone),
          amount: -p.amount,
          kind: 'sale_cancelled',
          label,
          sourceId: sale.id,
        });
    }
  }
  for (const r of sales.repayments) {
    const customer = sales.customers.find(
      (c) => c.id === r.customerId && c.organizationId === orgId,
    );
    const account = customer && accountFor(r.method, r.provider);
    if (account)
      out.push({
        accountId: account.id,
        day: dayIn(r.at, timeZone),
        amount: r.amount,
        kind: 'repayment',
        label: customer.name,
        sourceId: customer.id,
      });
  }
  for (const invoice of documentsState().invoices.filter(
    (i) => i.organizationId === orgId,
  ))
    for (const p of invoice.payments.filter((x) => !x.fromSale)) {
      const account = accountFor(p.method, p.provider);
      if (account)
        out.push({
          accountId: account.id,
          day: p.paidOn,
          amount: p.amount,
          kind: 'invoice_payment',
          label: invoice.number ?? '',
          sourceId: invoice.id,
        });
    }
  for (const e of s.expenses.filter((x) => x.status === 'recorded'))
    out.push({
      accountId: e.cashAccountId,
      day: e.occurredOn,
      amount: -e.amount,
      kind: 'expense',
      label: e.label,
      sourceId: e.id,
    });
  for (const t of s.transfers) {
    const name = (id) => s.accounts.find((a) => a.id === id).name;
    out.push({
      accountId: t.fromAccountId,
      day: t.occurredOn,
      amount: -t.amount,
      kind: 'transfer_out',
      label: name(t.toAccountId),
      sourceId: t.id,
    });
    out.push({
      accountId: t.toAccountId,
      day: t.occurredOn,
      amount: t.amount,
      kind: 'transfer_in',
      label: name(t.fromAccountId),
      sourceId: t.id,
    });
  }
  for (const k of s.closings.filter((x) => x.difference !== 0))
    out.push({
      accountId: k.cashAccountId,
      day: k.day,
      amount: k.difference,
      kind: 'closing',
      label: k.note,
      sourceId: k.id,
    });
  return out;
}

function receivables(orgId) {
  const sales = salesState();
  let customers = 0;
  for (const c of sales.customers.filter((x) => x.organizationId === orgId)) {
    const credit = sales.sales
      .filter((x) => x.customerId === c.id && x.status === 'completed')
      .flatMap((x) => x.payments)
      .filter((p) => p.method === 'credit')
      .reduce((sum, p) => sum + p.amount, 0);
    const repaid = sales.repayments
      .filter((r) => r.customerId === c.id)
      .reduce((sum, r) => sum + r.amount, 0);
    customers += Math.max(credit - repaid, 0);
  }
  const invoices = documentsState()
    .invoices.filter(
      (i) =>
        i.organizationId === orgId &&
        i.kind === 'invoice' &&
        i.status === 'issued',
    )
    .reduce((sum, i) => {
      const total =
        i.lines.reduce((t, l) => t + Math.round(l.unitPrice * l.quantity), 0) -
        i.discount;
      return (
        sum + Math.max(total - i.payments.reduce((p, x) => p + x.amount, 0), 0)
      );
    }, 0);
  return { customers, invoices };
}

/** Statistics of each shop of the person where their role may read them. */
export function shopsSummary(userId, organizations, memberships, query) {
  return memberships
    .filter(
      (m) =>
        m.userId === userId &&
        m.status === 'active' &&
        roleHasPermission(m.role, 'stats.read'),
    )
    .map((m) => organizations[m.organizationId])
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((org) => {
      const day = dayIn(new Date().toISOString(), org.timezone);
      const to = query.to ?? day;
      const from = query.from ?? addDays(to, -29);
      const sales = salesState().sales.filter(
        (x) => x.organizationId === org.id && x.status === 'completed',
      );
      const sum = (list) => ({
        revenue: list.reduce((t, x) => t + x.total, 0),
        count: list.length,
      });
      return {
        organizationId: org.id,
        name: org.name,
        currency: org.defaultCurrency,
        role: memberships.find(
          (m) => m.organizationId === org.id && m.userId === userId,
        ).role,
        today: sum(
          sales.filter((x) => dayIn(x.occurredAt, org.timezone) === day),
        ),
        period: sum(
          sales.filter((x) => {
            const d = dayIn(x.occurredAt, org.timezone);
            return d >= from && d <= to;
          }),
        ),
      };
    });
}

/** Handles treasury and statistics routes; returns false for other paths. */
export async function handleTreasury(ctx) {
  const {
    req,
    res,
    path,
    url,
    user,
    orgId,
    role,
    organization,
    send,
    apiError,
  } = ctx;
  if (
    !/^\/api\/v1\/(treasury|expenses|expense-categories|stats)(\/|$)/.test(path)
  )
    return false;
  const reply = (status, body) => {
    send(res, status, body);
    return true;
  };
  const fail = (status, code, message) => {
    apiError(res, status, code, message);
    return true;
  };
  const invalid = (issues) =>
    reply(400, {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Données invalides.',
        details: issues.map((i) => ({
          path: Array.isArray(i.path) ? i.path.join('.') : i.path,
          message: i.message,
        })),
      },
    });
  const permission = path.startsWith('/api/v1/stats')
    ? 'stats.read'
    : req.method === 'GET'
      ? 'treasury.read'
      : 'treasury.manage';
  if (!roleHasPermission(role, permission)) {
    ctx.forbidden(res);
    return true;
  }
  const s = shop(orgId);
  const timeZone = organization.timezone;
  const today = dayIn(new Date().toISOString(), timeZone);
  const body = req.method === 'GET' ? null : await ctx.readJson(req);
  const params = Object.fromEntries(url.searchParams);
  const lastClosing = (accountId) =>
    s.closings
      .filter((k) => k.cashAccountId === accountId)
      .map((k) => k.day)
      .sort()
      .at(-1) ?? null;
  const accountDto = (a, moves = movements(orgId, timeZone)) => {
    const own = moves.filter((m) => m.accountId === a.id);
    return {
      id: a.id,
      kind: a.kind,
      provider: a.provider,
      name: a.name,
      openingBalance: a.openingBalance,
      balance: a.openingBalance + own.reduce((t, m) => t + m.amount, 0),
      used: a.kind === 'cash' || a.openingBalance !== 0 || own.length > 0,
    };
  };
  const overview = () => {
    const moves = movements(orgId, timeZone);
    const accounts = s.accounts.map((a) => accountDto(a, moves));
    const flows = moves.filter(
      (m) => m.day === today && !m.kind.startsWith('transfer'),
    );
    return {
      accounts,
      total: accounts.reduce((t, a) => t + a.balance, 0),
      receivables: receivables(orgId),
      today: {
        day: today,
        moneyIn: flows
          .filter((m) => m.amount > 0)
          .reduce((t, m) => t + m.amount, 0),
        moneyOut: -flows
          .filter((m) => m.amount < 0)
          .reduce((t, m) => t + m.amount, 0),
      },
    };
  };
  const openDay = (accountIds, day) => {
    if (day > today)
      return fail(400, 'VALIDATION_FAILED', 'Cette date est dans le futur.');
    for (const id of accountIds) {
      const last = lastClosing(id);
      if (last && day <= last)
        return fail(
          409,
          'DAY_ALREADY_CLOSED',
          `La caisse a été clôturée le ${last.split('-').reverse().join('/')} : choisissez une date après.`,
        );
    }
    return false;
  };
  const expected = (account, day) => {
    const own = movements(orgId, timeZone).filter(
      (m) => m.accountId === account.id,
    );
    const ofDay = own.filter(
      (m) => m.day === day && !(m.kind === 'closing' && m.day === day),
    );
    return {
      expectedAmount:
        account.openingBalance +
        own.filter((m) => m.day <= day).reduce((t, m) => t + m.amount, 0),
      moneyIn: ofDay
        .filter((m) => m.amount > 0)
        .reduce((t, m) => t + m.amount, 0),
      moneyOut: -ofDay
        .filter((m) => m.amount < 0)
        .reduce((t, m) => t + m.amount, 0),
    };
  };
  const closingDto = (k) => ({
    id: k.id,
    account: {
      id: k.cashAccountId,
      name: s.accounts.find((a) => a.id === k.cashAccountId).name,
    },
    day: k.day,
    expectedAmount: k.expectedAmount,
    countedAmount: k.countedAmount,
    difference: k.difference,
    note: k.note,
    closedBy: { userId: user.id, email: user.email },
    createdAt: k.createdAt,
  });
  const expenseDto = (e) => {
    const category = s.categories.find((c) => c.id === e.categoryId);
    return {
      id: e.id,
      category: {
        id: category.id,
        name: category.name,
        accountCode: category.accountCode,
      },
      account: {
        id: e.cashAccountId,
        name: s.accounts.find((a) => a.id === e.cashAccountId).name,
      },
      label: e.label,
      amount: e.amount,
      occurredOn: e.occurredOn,
      status: e.status,
      cancellation: e.cancellation,
      createdBy: { userId: user.id, email: user.email },
      createdAt: e.createdAt,
    };
  };

  if (path === '/api/v1/stats/summary') {
    const parsed = periodQuerySchema.safeParse(params);
    if (!parsed.success) return invalid(parsed.error.issues);
    const to = parsed.data.to ?? today;
    const from = parsed.data.from ?? to;
    const sales = salesState().sales.filter((x) => {
      const d = dayIn(x.occurredAt, timeZone);
      return (
        x.organizationId === orgId &&
        x.status === 'completed' &&
        d >= from &&
        d <= to
      );
    });
    const revenue = sales.reduce((t, x) => t + x.total, 0);
    const byMethod = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0]));
    for (const x of sales)
      for (const p of x.payments) byMethod[p.method] += p.amount;
    const days = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const ofDay = sales.filter((x) => dayIn(x.occurredAt, timeZone) === d);
      days.push({
        day: d,
        revenue: ofDay.reduce((t, x) => t + x.total, 0),
        count: ofDay.length,
      });
    }
    const catalog = catalogState();
    const byProduct = new Map();
    let costedRevenue = 0;
    let cost = 0;
    for (const x of sales)
      for (const l of x.lines) {
        const net =
          x.subtotal === 0
            ? 0
            : Math.round((l.lineTotal * x.total) / x.subtotal);
        const entry = byProduct.get(l.productId) ?? {
          productId: l.productId,
          label: l.label,
          unit: l.unit,
          quantity: 0,
          revenue: 0,
        };
        entry.quantity += l.quantity;
        entry.revenue += net;
        byProduct.set(l.productId, entry);
        const product = catalog.products.find((p) => p.id === l.productId);
        if (product?.purchasePrice != null) {
          costedRevenue += net;
          cost += Math.round(l.quantity * product.purchasePrice);
        }
      }
    const stockOf = (id) =>
      catalog.movements
        .filter((m) => m.productId === id)
        .reduce((t, m) => t + m.quantity, 0);
    return reply(200, {
      from,
      to,
      salesCount: sales.length,
      revenue,
      discount: sales.reduce((t, x) => t + x.discount, 0),
      taxTotal: sales.reduce((t, x) => t + x.taxTotal, 0),
      averageBasket: sales.length ? Math.round(revenue / sales.length) : 0,
      margin: {
        amount: costedRevenue - cost,
        costedRevenue,
        coverageBasisPoints: shareBasisPoints(costedRevenue, revenue),
      },
      byMethod,
      days,
      topProducts: [...byProduct.values()]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
      slowProducts: catalog.products
        .filter(
          (p) =>
            p.organizationId === orgId &&
            p.status === 'active' &&
            p.trackStock &&
            stockOf(p.id) > 0 &&
            !byProduct.has(p.id),
        )
        .map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          stockQuantity: stockOf(p.id),
        })),
      expenses: s.expenses
        .filter(
          (e) =>
            e.status === 'recorded' &&
            e.occurredOn >= from &&
            e.occurredOn <= to,
        )
        .reduce((t, e) => t + e.amount, 0),
    });
  }

  if (path === '/api/v1/treasury' && req.method === 'GET')
    return reply(200, overview());
  if (path === '/api/v1/treasury/movements' && req.method === 'GET') {
    const parsed = movementsQuerySchema.safeParse(params);
    if (!parsed.success) return invalid(parsed.error.issues);
    const account = s.accounts.find((a) => a.id === parsed.data.accountId);
    if (!account)
      return fail(404, 'CASH_ACCOUNT_NOT_FOUND', 'Caisse introuvable.');
    const to = parsed.data.to ?? today;
    const from = parsed.data.from ?? addDays(to, -30);
    const own = movements(orgId, timeZone).filter(
      (m) => m.accountId === account.id,
    );
    const until = (day) =>
      account.openingBalance +
      own.filter((m) => m.day <= day).reduce((t, m) => t + m.amount, 0);
    return reply(200, {
      account: accountDto(account),
      from,
      to,
      startBalance: until(addDays(from, -1)),
      endBalance: until(to),
      movements: own
        .filter((m) => m.day >= from && m.day <= to)
        .sort((a, b) => b.day.localeCompare(a.day))
        .map(({ kind, amount, day, label, sourceId }) => ({
          kind,
          amount,
          day,
          label,
          sourceId,
        })),
      lastClosingDay: lastClosing(account.id),
    });
  }
  const accountMatch = /^\/api\/v1\/treasury\/accounts\/([^/]+)$/.exec(path);
  if (accountMatch && req.method === 'PATCH') {
    const account = s.accounts.find((a) => a.id === accountMatch[1]);
    if (!account)
      return fail(404, 'CASH_ACCOUNT_NOT_FOUND', 'Caisse introuvable.');
    const parsed = updateCashAccountSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error.issues);
    if (parsed.data.openingBalance !== undefined && lastClosing(account.id))
      return fail(
        409,
        'ACCOUNT_ALREADY_COUNTED',
        'Cette caisse a déjà été clôturée : son solde de départ ne change plus.',
      );
    if (parsed.data.name !== undefined) account.name = parsed.data.name;
    if (parsed.data.openingBalance !== undefined)
      account.openingBalance = parsed.data.openingBalance;
    return reply(200, accountDto(account));
  }
  if (path === '/api/v1/treasury/transfers' && req.method === 'POST') {
    const parsed = createTransferSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error.issues);
    const t = parsed.data;
    if (s.transfers.some((x) => x.clientOperationId === t.clientOperationId))
      return reply(200, overview());
    if (
      !s.accounts.some((a) => a.id === t.fromAccountId) ||
      !s.accounts.some((a) => a.id === t.toAccountId)
    )
      return fail(404, 'CASH_ACCOUNT_NOT_FOUND', 'Caisse introuvable.');
    if (openDay([t.fromAccountId, t.toAccountId], t.occurredOn)) return true;
    s.transfers.push({ id: randomUUID(), ...t });
    return reply(201, overview());
  }
  if (path === '/api/v1/treasury/closings' && req.method === 'GET')
    return reply(
      200,
      s.closings
        .filter(
          (k) => !params.accountId || k.cashAccountId === params.accountId,
        )
        .map(closingDto)
        .reverse(),
    );
  if (path === '/api/v1/treasury/closings/expected' && req.method === 'GET') {
    const account = s.accounts.find((a) => a.id === params.cashAccountId);
    if (!account)
      return fail(404, 'CASH_ACCOUNT_NOT_FOUND', 'Caisse introuvable.');
    const closing = s.closings.find(
      (k) => k.cashAccountId === account.id && k.day === params.day,
    );
    const figures = expected(account, params.day);
    return reply(200, {
      accountId: account.id,
      day: params.day,
      ...figures,
      expectedAmount: closing ? closing.expectedAmount : figures.expectedAmount,
      closing: closing ? closingDto(closing) : null,
    });
  }
  if (path === '/api/v1/treasury/closings' && req.method === 'POST') {
    const parsed = createClosingSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error.issues);
    const c = parsed.data;
    const previous = s.closings.find(
      (k) => k.clientOperationId === c.clientOperationId,
    );
    if (previous) return reply(200, closingDto(previous));
    const account = s.accounts.find((a) => a.id === c.cashAccountId);
    if (!account)
      return fail(404, 'CASH_ACCOUNT_NOT_FOUND', 'Caisse introuvable.');
    if (c.day > today)
      return fail(
        400,
        'VALIDATION_FAILED',
        'On ne clôture pas un jour à venir.',
      );
    const last = lastClosing(account.id);
    if (last && c.day <= last)
      return fail(
        409,
        'DAY_ALREADY_CLOSED',
        'Cette journée est déjà clôturée pour cette caisse.',
      );
    const { expectedAmount } = expected(account, c.day);
    const closing = {
      id: randomUUID(),
      cashAccountId: account.id,
      day: c.day,
      expectedAmount,
      countedAmount: c.countedAmount,
      difference: c.countedAmount - expectedAmount,
      note: c.note,
      clientOperationId: c.clientOperationId,
      createdAt: new Date().toISOString(),
    };
    s.closings.push(closing);
    return reply(201, closingDto(closing));
  }

  if (path === '/api/v1/expense-categories' && req.method === 'GET')
    return reply(200, s.categories);
  if (path === '/api/v1/expense-categories' && req.method === 'POST') {
    const parsed = createExpenseCategorySchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error.issues);
    if (
      s.categories.some(
        (c) =>
          c.status === 'active' &&
          c.name.toLowerCase() === parsed.data.name.toLowerCase(),
      )
    )
      return fail(409, 'NAME_TAKEN', 'Une catégorie porte déjà ce nom.');
    const category = { id: randomUUID(), ...parsed.data, status: 'active' };
    s.categories.push(category);
    return reply(201, category);
  }
  const categoryMatch = /^\/api\/v1\/expense-categories\/([^/]+)$/.exec(path);
  if (categoryMatch && req.method === 'PATCH') {
    const category = s.categories.find((c) => c.id === categoryMatch[1]);
    if (!category)
      return fail(
        404,
        'EXPENSE_CATEGORY_NOT_FOUND',
        'Catégorie de dépense introuvable.',
      );
    const parsed = updateExpenseCategorySchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error.issues);
    for (const [key, value] of Object.entries(parsed.data))
      if (value !== undefined) category[key] = value;
    return reply(200, category);
  }
  if (path === '/api/v1/expenses' && req.method === 'GET') {
    const parsed = periodQuerySchema.safeParse(params);
    if (!parsed.success) return invalid(parsed.error.issues);
    const to = parsed.data.to ?? today;
    const from = parsed.data.from ?? addDays(to, -30);
    return reply(
      200,
      s.expenses
        .filter((e) => e.occurredOn >= from && e.occurredOn <= to)
        .reverse()
        .map(expenseDto),
    );
  }
  if (path === '/api/v1/expenses' && req.method === 'POST') {
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error.issues);
    const e = parsed.data;
    const previous = s.expenses.find(
      (x) => x.clientOperationId === e.clientOperationId,
    );
    if (previous) return reply(200, expenseDto(previous));
    if (
      !s.categories.some((c) => c.id === e.categoryId && c.status === 'active')
    )
      return invalid([{ path: 'categoryId', message: 'Catégorie inconnue.' }]);
    if (!s.accounts.some((a) => a.id === e.cashAccountId))
      return invalid([{ path: 'cashAccountId', message: 'Caisse inconnue.' }]);
    if (openDay([e.cashAccountId], e.occurredOn)) return true;
    const expense = {
      id: randomUUID(),
      ...e,
      status: 'recorded',
      cancellation: null,
      createdAt: new Date().toISOString(),
    };
    s.expenses.push(expense);
    return reply(201, expenseDto(expense));
  }
  const cancelMatch = /^\/api\/v1\/expenses\/([^/]+)\/cancel$/.exec(path);
  if (cancelMatch && req.method === 'POST') {
    const expense = s.expenses.find((x) => x.id === cancelMatch[1]);
    if (!expense) return fail(404, 'EXPENSE_NOT_FOUND', 'Dépense introuvable.');
    const parsed = cancelExpenseSchema.safeParse(body);
    if (!parsed.success) return invalid(parsed.error.issues);
    if (expense.status !== 'recorded')
      return fail(
        409,
        'EXPENSE_ALREADY_CANCELLED',
        'Cette dépense est déjà annulée.',
      );
    const last = lastClosing(expense.cashAccountId);
    if (last && expense.occurredOn <= last)
      return fail(
        409,
        'DAY_ALREADY_CLOSED',
        'La caisse a été clôturée depuis cette dépense : elle ne s’annule plus.',
      );
    expense.status = 'cancelled';
    expense.cancellation = {
      at: new Date().toISOString(),
      reason: parsed.data.reason,
    };
    return reply(200, expenseDto(expense));
  }
  return fail(404, 'NOT_FOUND', 'Introuvable.');
}
