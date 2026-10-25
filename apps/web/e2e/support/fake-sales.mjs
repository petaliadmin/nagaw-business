// Sales and customers part of the fake API (see fake-backend.mjs). Same
// shared schemas and rules as the real API: prices and totals from the
// catalogue, payments covering the total, sellers seeing their own sales,
// cancellation by managers putting the goods back in stock.
import { randomUUID } from 'node:crypto';
import {
  cancelSaleSchema,
  computeSaleTotals,
  createCustomerSchema,
  createSaleSchema,
  customerRepaymentSchema,
  deviceTicketPrefix,
  registerDeviceSchema,
  syncRequestSchema,
  paymentProblem,
  updateCustomerSchema,
} from '@nagaw/shared';
import { catalogState } from './fake-catalog.mjs';

const ACME = '11111111-1111-4111-8111-111111111111';
const AWA = 'aaaaaaaa-0000-4000-8000-000000000001';

function seed() {
  return {
    nextNumber: {},
    sales: [],
    customers: [
      {
        id: 'eeeeeeee-0000-4000-8000-000000000001',
        organizationId: ACME,
        name: 'Fatou Ndiaye',
        phone: '77 111 22 33',
        email: '',
        address: 'Rue 12, Médina, Dakar',
        taxId: '',
        notes: '',
        creditLimit: null,
        status: 'active',
        createdAt: '2026-10-02T09:00:00.000Z',
        updatedAt: '2026-10-02T09:00:00.000Z',
        createdBy: AWA,
      },
    ],
    repayments: [],
    devices: [],
  };
}

let state = seed();
export function resetSales() {
  state = seed();
}
export const salesState = () => state;

const today = (timeZone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
const dayOf = (iso, timeZone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(iso));

function balance(customerId) {
  const credit = state.sales
    .filter((s) => s.customerId === customerId && s.status === 'completed')
    .flatMap((s) => s.payments)
    .filter((p) => p.method === 'credit')
    .reduce((sum, p) => sum + p.amount, 0);
  const repaid = state.repayments
    .filter((r) => r.customerId === customerId)
    .reduce((sum, r) => sum + r.amount, 0);
  return credit - repaid;
}

const customerDto = (c) => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  email: c.email,
  address: c.address,
  taxId: c.taxId,
  notes: c.notes,
  creditLimit: c.creditLimit,
  balance: balance(c.id),
  status: c.status,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

function saleDto(sale, userById) {
  const customer = state.customers.find((c) => c.id === sale.customerId);
  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    status: sale.status,
    customer: customer
      ? { id: customer.id, name: customer.name, phone: customer.phone }
      : null,
    seller: { userId: sale.sellerId, email: userById(sale.sellerId).email },
    lines: sale.lines,
    payments: sale.payments,
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    taxTotal: sale.taxTotal,
    cashReceived: sale.cashReceived,
    changeGiven: sale.changeGiven,
    occurredAt: sale.occurredAt,
    deviceTicket: sale.deviceTicket ?? null,
    priceReview: sale.priceReview ?? false,
    cancellation: sale.cancellation
      ? {
          ...sale.cancellation,
          by: {
            userId: sale.cancellation.by,
            email: userById(sale.cancellation.by).email,
          },
        }
      : null,
  };
}

const deviceDto = (d, userById) => ({
  id: d.id,
  label: d.label,
  ticketPrefix: d.ticketPrefix,
  user: { userId: d.userId, email: userById(d.userId).email },
  lastSyncedAt: d.lastSyncedAt,
  revokedAt: d.revokedAt,
  createdAt: d.createdAt,
});

/**
 * Handles sales and customer routes; returns false for other paths.
 * `ctx` as for handleCatalog, plus `role` and `timeZone`.
 */
export async function handleSales(ctx) {
  const { req, res, path, url, user, orgId, role, timeZone, send, apiError } =
    ctx;
  const mine = (item) => item.organizationId === orgId;
  const manager = role === 'owner' || role === 'admin';
  const seesAll = manager || role === 'viewer';
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
  const deny = () => {
    ctx.forbidden(res);
    return true;
  };
  const visibleSales = () =>
    state.sales.filter((s) => mine(s) && (seesAll || s.sellerId === user.id));

  if (path === '/api/v1/sales' && req.method === 'GET') {
    const day = url.searchParams.get('day') ?? today(timeZone);
    return reply(
      200,
      visibleSales()
        .filter((s) => dayOf(s.occurredAt, timeZone) === day)
        .reverse()
        .map((s) => ({
          id: s.id,
          saleNumber: s.saleNumber,
          status: s.status,
          customerName:
            state.customers.find((c) => c.id === s.customerId)?.name ?? null,
          sellerEmail: ctx.userById(s.sellerId).email,
          itemCount: s.lines.length,
          total: s.total,
          methods: [...new Set(s.payments.map((p) => p.method))],
          occurredAt: s.occurredAt,
          deviceTicket: s.deviceTicket ?? null,
          priceReview: s.priceReview ?? false,
        })),
    );
  }
  if (path === '/api/v1/sales/summary' && req.method === 'GET') {
    const day = url.searchParams.get('day') ?? today(timeZone);
    const ofDay = visibleSales().filter(
      (s) => dayOf(s.occurredAt, timeZone) === day,
    );
    const done = ofDay.filter((s) => s.status === 'completed');
    const byMethod = { cash: 0, mobile_money: 0, card: 0, credit: 0 };
    for (const p of done.flatMap((s) => s.payments))
      byMethod[p.method] += p.amount;
    return reply(200, {
      day,
      count: done.length,
      total: done.reduce((sum, s) => sum + s.total, 0),
      byMethod,
      cancelledCount: ofDay.length - done.length,
    });
  }
  // Shared by POST /sales and the device sales of POST /sync (ADR-020):
  // online, prices come from the catalogue; from a device, the prices the
  // customer paid are kept and flagged when they differ.
  const refusal = (status, code, message, path) => ({
    ok: false,
    status,
    code,
    message,
    details: path ? [{ path, message }] : undefined,
  });
  function record(input, device) {
    const replay = state.sales.find(
      (s) => mine(s) && s.clientOperationId === input.clientOperationId,
    );
    if (replay) return { ok: true, status: 200, sale: replay };
    const catalog = catalogState();
    const lines = [];
    for (const [index, line] of input.lines.entries()) {
      const product = catalog.products.find(
        (p) =>
          mine(p) &&
          p.id === line.productId &&
          (device || p.status === 'active'),
      );
      if (!product)
        return refusal(
          400,
          'VALIDATION_FAILED',
          'Produit inconnu ou archivé.',
          `lines.${index}.productId`,
        );
      lines.push({
        product,
        quantity: line.quantity,
        unitPrice: device ? line.unitPrice : product.salePrice,
      });
    }
    const rate = (product) =>
      catalog.taxRates.find((t) => t.id === product.taxRateId)
        ?.rateBasisPoints ?? null;
    const totals = computeSaleTotals(
      lines.map(({ product, quantity, unitPrice }) => ({
        unitPrice,
        quantity,
        taxRateBasisPoints: rate(product),
      })),
      input.discount,
    );
    if (!device && totals.total !== input.expectedTotal)
      return refusal(
        409,
        'PRICE_CHANGED',
        'Les prix ont changé : rechargez la caisse.',
      );
    const problem = paymentProblem({
      total: totals.total,
      payments: input.payments,
      cashReceived: input.cashReceived,
      customerId: input.customerId,
    });
    if (problem)
      return refusal(400, 'VALIDATION_FAILED', problem.message, problem.path);
    if (
      input.customerId &&
      !state.customers.some((c) => mine(c) && c.id === input.customerId)
    )
      return refusal(400, 'VALIDATION_FAILED', 'Client inconnu.', 'customerId');
    const cash = input.payments
      .filter((p) => p.method === 'cash')
      .reduce((sum, p) => sum + p.amount, 0);
    state.nextNumber[orgId] = (state.nextNumber[orgId] ?? 0) + 1;
    const sale = {
      id: randomUUID(),
      organizationId: orgId,
      saleNumber: state.nextNumber[orgId],
      status: 'completed',
      customerId: input.customerId,
      sellerId: user.id,
      lines: lines.map(({ product, quantity, unitPrice }, index) => ({
        position: index + 1,
        productId: product.id,
        label: product.name,
        unit: product.unit,
        unitPrice,
        quantity,
        lineTotal: totals.lines[index].lineTotal,
        taxRateBasisPoints: rate(product),
        taxAmount: totals.lines[index].taxAmount,
      })),
      payments: input.payments.map((p) => ({
        method: p.method,
        provider: p.provider,
        reference: p.reference,
        amount: p.amount,
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      taxTotal: totals.taxTotal,
      cashReceived: input.cashReceived,
      changeGiven:
        input.cashReceived === null ? null : input.cashReceived - cash,
      clientOperationId: input.clientOperationId,
      occurredAt: device?.occurredAt ?? new Date().toISOString(),
      deviceTicket: device?.deviceTicket ?? null,
      priceReview: lines.some((l) => l.unitPrice !== l.product.salePrice),
      cancellation: null,
    };
    state.sales.push(sale);
    for (const { product, quantity } of lines.filter(
      (l) => l.product.trackStock,
    ))
      catalog.movements.push({
        id: randomUUID(),
        organizationId: orgId,
        productId: product.id,
        kind: 'sale',
        quantity: -quantity,
        countedQuantity: null,
        unitCost: null,
        supplierId: null,
        reason: null,
        clientOperationId: randomUUID(),
        createdBy: user.id,
        occurredAt: sale.occurredAt,
        saleId: sale.id,
      });
    return { ok: true, status: 201, sale };
  }
  const answer = (result) =>
    result.ok
      ? reply(result.status, saleDto(result.sale, ctx.userById))
      : reply(result.status, {
          error: {
            code: result.code,
            message: result.message,
            details: result.details,
          },
        });

  if (path === '/api/v1/sales' && req.method === 'POST') {
    if (role === 'viewer') return deny();
    const parsed = createSaleSchema.safeParse(await ctx.readJson(req));
    if (!parsed.success) return invalid(parsed.error.issues);
    return answer(record(parsed.data, null));
  }

  if (path === '/api/v1/devices' && req.method === 'GET')
    return reply(
      200,
      state.devices
        .filter((d) => mine(d) && (manager || d.userId === user.id))
        .map((d) => deviceDto(d, ctx.userById)),
    );
  if (path === '/api/v1/devices' && req.method === 'POST') {
    if (role === 'viewer') return deny();
    const parsed = registerDeviceSchema.safeParse(await ctx.readJson(req));
    if (!parsed.success) return invalid(parsed.error.issues);
    const replay = state.devices.find(
      (d) => mine(d) && d.clientOperationId === parsed.data.clientOperationId,
    );
    if (replay) return reply(200, deviceDto(replay, ctx.userById));
    const count = state.devices.filter(mine).length;
    const device = {
      id: randomUUID(),
      organizationId: orgId,
      userId: user.id,
      label: parsed.data.label,
      ticketPrefix: deviceTicketPrefix(count + 1),
      clientOperationId: parsed.data.clientOperationId,
      lastSyncedAt: null,
      revokedAt: null,
      createdAt: new Date().toISOString(),
    };
    state.devices.push(device);
    return reply(201, deviceDto(device, ctx.userById));
  }
  const revoke = /^\/api\/v1\/devices\/([^/]+)\/revoke$/.exec(path);
  if (revoke && req.method === 'POST') {
    if (!manager) return deny();
    const device = state.devices.find((d) => mine(d) && d.id === revoke[1]);
    if (!device) return fail(404, 'DEVICE_NOT_FOUND', 'Appareil introuvable.');
    device.revokedAt ??= new Date().toISOString();
    return reply(200, deviceDto(device, ctx.userById));
  }
  if (path === '/api/v1/sync' && req.method === 'POST') {
    if (role === 'viewer') return deny();
    const parsed = syncRequestSchema.safeParse(await ctx.readJson(req));
    if (!parsed.success) return invalid(parsed.error.issues);
    const device = state.devices.find(
      (d) => mine(d) && d.id === parsed.data.deviceId && d.userId === user.id,
    );
    if (!device) return fail(404, 'DEVICE_NOT_FOUND', 'Appareil introuvable.');
    if (device.revokedAt)
      return fail(403, 'DEVICE_REVOKED', 'Cet appareil a été retiré.');
    const results = [];
    for (const op of parsed.data.operations) {
      if (op.type === 'customer') {
        let customer = state.customers.find(
          (c) => mine(c) && c.clientOperationId === op.clientOperationId,
        );
        const duplicate = Boolean(customer);
        if (!customer) {
          customer = {
            id: randomUUID(),
            organizationId: orgId,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: user.id,
            clientOperationId: op.clientOperationId,
            ...op.data,
          };
          state.customers.push(customer);
        }
        results.push({
          clientOperationId: op.clientOperationId,
          status: duplicate ? 'duplicate' : 'accepted',
          customerId: customer.id,
        });
        continue;
      }
      const data = op.data;
      const customerId = data.customerOperationId
        ? (state.customers.find(
            (c) => mine(c) && c.clientOperationId === data.customerOperationId,
          )?.id ?? null)
        : data.customerId;
      const result = record(
        {
          clientOperationId: op.clientOperationId,
          customerId,
          lines: data.lines,
          discount: data.discount,
          payments: data.payments,
          cashReceived: data.cashReceived,
        },
        { occurredAt: data.occurredAt, deviceTicket: data.deviceTicket },
      );
      results.push(
        result.ok
          ? {
              clientOperationId: op.clientOperationId,
              status: result.status === 200 ? 'duplicate' : 'accepted',
              saleId: result.sale.id,
              saleNumber: result.sale.saleNumber,
              priceReview: result.sale.priceReview,
            }
          : {
              clientOperationId: op.clientOperationId,
              status: 'rejected',
              error: { code: result.code, message: result.message },
            },
      );
    }
    device.lastSyncedAt = new Date().toISOString();
    return reply(200, { results });
  }
  const saleMatch = /^\/api\/v1\/sales\/([^/]+)(\/cancel)?$/.exec(path);
  if (saleMatch) {
    const sale = visibleSales().find((s) => s.id === saleMatch[1]);
    if (!sale) return fail(404, 'SALE_NOT_FOUND', 'Vente introuvable.');
    if (!saleMatch[2] && req.method === 'GET')
      return reply(200, saleDto(sale, ctx.userById));
    if (saleMatch[2] && req.method === 'POST') {
      if (!manager) return deny();
      const parsed = cancelSaleSchema.safeParse(await ctx.readJson(req));
      if (!parsed.success) return invalid(parsed.error.issues);
      if (sale.status === 'cancelled')
        return fail(
          409,
          'SALE_ALREADY_CANCELLED',
          'Cette vente est déjà annulée.',
        );
      sale.status = 'cancelled';
      sale.cancellation = {
        at: new Date().toISOString(),
        by: user.id,
        reason: parsed.data.reason,
      };
      const catalog = catalogState();
      for (const m of catalog.movements.filter(
        (m) => m.saleId === sale.id && m.kind === 'sale',
      ))
        catalog.movements.push({
          ...m,
          id: randomUUID(),
          kind: 'return',
          quantity: -m.quantity,
          reason: `Vente n° ${sale.saleNumber} annulée`,
          clientOperationId: randomUUID(),
          createdBy: user.id,
        });
      return reply(200, saleDto(sale, ctx.userById));
    }
  }

  if (path === '/api/v1/customers' && req.method === 'GET') {
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const owing = url.searchParams.get('owing') === 'true';
    return reply(
      200,
      state.customers
        .filter((c) => mine(c) && c.status === 'active')
        .filter(
          (c) =>
            !q ||
            c.name.toLowerCase().includes(q) ||
            c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')),
        )
        .map(customerDto)
        .filter((c) => !owing || c.balance > 0)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    );
  }
  if (path === '/api/v1/customers' && req.method === 'POST') {
    if (role === 'viewer') return deny();
    const parsed = createCustomerSchema.safeParse(await ctx.readJson(req));
    if (!parsed.success) return invalid(parsed.error.issues);
    const replay = state.customers.find(
      (c) => mine(c) && c.clientOperationId === parsed.data.clientOperationId,
    );
    if (replay) return reply(200, customerDto(replay));
    const customer = {
      id: randomUUID(),
      organizationId: orgId,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.id,
      ...parsed.data,
    };
    state.customers.push(customer);
    return reply(201, customerDto(customer));
  }
  const customerMatch = /^\/api\/v1\/customers\/([^/]+)(\/payments)?$/.exec(
    path,
  );
  if (customerMatch) {
    const customer = state.customers.find(
      (c) => mine(c) && c.id === customerMatch[1],
    );
    if (!customer)
      return fail(404, 'CUSTOMER_NOT_FOUND', 'Client introuvable.');
    if (!customerMatch[2] && req.method === 'GET') {
      const activity = [
        ...state.sales
          .filter(
            (s) => s.customerId === customer.id && s.status === 'completed',
          )
          .flatMap((s) =>
            s.payments
              .filter((p) => p.method === 'credit')
              .map((p) => ({
                kind: 'credit_sale',
                id: s.id,
                saleNumber: s.saleNumber,
                amount: p.amount,
                method: 'credit',
                at: s.occurredAt,
              })),
          ),
        ...state.repayments
          .filter((r) => r.customerId === customer.id)
          .map((r) => ({
            kind: 'repayment',
            id: r.id,
            saleNumber: null,
            amount: r.amount,
            method: r.method,
            at: r.at,
          })),
      ].sort((a, b) => b.at.localeCompare(a.at));
      return reply(200, { ...customerDto(customer), activity });
    }
    if (role === 'viewer') return deny();
    if (!customerMatch[2] && req.method === 'PATCH') {
      const parsed = updateCustomerSchema.safeParse(await ctx.readJson(req));
      if (!parsed.success) return invalid(parsed.error.issues);
      for (const [key, value] of Object.entries(parsed.data))
        if (value !== undefined) customer[key] = value;
      customer.updatedAt = new Date().toISOString();
      return reply(200, customerDto(customer));
    }
    if (customerMatch[2] && req.method === 'POST') {
      const parsed = customerRepaymentSchema.safeParse(await ctx.readJson(req));
      if (!parsed.success) return invalid(parsed.error.issues);
      if (
        state.repayments.some(
          (r) => r.clientOperationId === parsed.data.clientOperationId,
        )
      )
        return reply(200, customerDto(customer));
      if (parsed.data.amount > balance(customer.id))
        return fail(
          409,
          'REPAYMENT_TOO_HIGH',
          'Ce montant dépasse ce que le client doit.',
        );
      state.repayments.push({
        id: randomUUID(),
        customerId: customer.id,
        at: new Date().toISOString(),
        ...parsed.data,
      });
      return reply(201, customerDto(customer));
    }
  }
  return false;
}
