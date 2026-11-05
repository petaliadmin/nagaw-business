// Fake catalogue in a link and orders (ADR-063), for the e2e tests: the
// rules the real API applies to what the screens show, no more.
import { randomUUID } from 'node:crypto';
import { catalogState } from './fake-catalog.mjs';

let orders = [];
let settings = {};

export function resetOrders() {
  orders = [];
  settings = {};
}

const settingsOf = (orgId) =>
  (settings[orgId] ??= {
    published: false,
    waveNumber: '',
    orangeMoneyNumber: '',
    note: '',
  });

const stockOf = (productId) =>
  catalogState()
    .movements.filter((m) => m.productId === productId)
    .reduce((sum, m) => sum + m.quantity, 0);

function onlineProducts(orgId) {
  return catalogState()
    .products.filter(
      (p) =>
        p.organizationId === orgId &&
        p.status !== 'archived' &&
        p.soldOnline !== false &&
        p.salePrice > 0,
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.salePrice,
      unit: p.unit,
      available: !p.trackStock || stockOf(p.id) > 0,
      photoVersion: null,
      category: null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function publicShop(org) {
  const s = settingsOf(org.id);
  return {
    slug: org.slug,
    name: org.name,
    currency: org.defaultCurrency,
    phoneCountryCode: org.phoneCountryCode ?? '221',
    phone: org.phone ?? '',
    logoVersion: null,
    note: s.note,
    payment: {
      wave: s.waveNumber || null,
      orangeMoney: s.orangeMoneyNumber || null,
    },
  };
}

/** Public routes, before any session. Returns false for other paths. */
export async function handlePublicOrders({
  req,
  res,
  path,
  organizations,
  send,
  apiError,
  readJson,
}) {
  const match = /^\/api\/v1\/public\/shops\/([^/]+)(\/orders)?$/.exec(path);
  if (!match) return false;
  const org = Object.values(organizations).find(
    (o) =>
      o.slug === match[1] &&
      settingsOf(o.id).published &&
      !(o.hiddenModules ?? []).includes('orders'),
  );
  if (!org) {
    apiError(
      res,
      404,
      'SHOP_NOT_FOUND',
      'Cette boutique n’a pas de catalogue en ligne.',
    );
    return true;
  }
  const products = onlineProducts(org.id);
  if (!match[2] && req.method === 'GET') {
    send(res, 200, { shop: publicShop(org), products });
    return true;
  }
  if (match[2] && req.method === 'POST') {
    const body = await readJson(req);
    const lines = body.lines.map((line) => {
      const product = products.find((p) => p.id === line.productId);
      return {
        productId: line.productId,
        label: product.name,
        unitPrice: product.price,
        quantity: line.quantity,
        lineTotal: product.price * line.quantity,
      };
    });
    const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const reference = `CMD-${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
    const digits = body.phone.replace(/\D/g, '');
    orders.unshift({
      id: randomUUID(),
      organizationId: org.id,
      reference,
      status: 'new',
      customerName: body.name,
      customerPhone: digits.startsWith('221') ? digits : `221${digits}`,
      customerArea: body.area,
      customerNote: body.note ?? '',
      total,
      currency: org.defaultCurrency,
      deliveryFee: 0,
      courierName: '',
      courierPhone: '',
      paidAt: null,
      payment: null,
      cancelReason: '',
      saleId: null,
      confirmedAt: null,
      shippedAt: null,
      deliveredAt: null,
      cancelledAt: null,
      createdAt: new Date().toISOString(),
      lines: lines.map((line, position) => ({ position, ...line })),
    });
    const shop = publicShop(org);
    send(res, 201, {
      reference,
      total,
      currency: org.defaultCurrency,
      lines: lines.map(({ label, quantity, lineTotal }) => ({
        label,
        quantity,
        lineTotal,
      })),
      shop: {
        name: shop.name,
        phone: shop.phone,
        phoneCountryCode: shop.phoneCountryCode,
        payment: shop.payment,
        note: shop.note,
      },
    });
    return true;
  }
  return false;
}

const NEXT = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'delivered', 'cancelled'],
  shipping: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

/** Shop routes of the orders. Returns false for other paths. */
export async function handleOrders({
  req,
  res,
  path,
  url,
  orgId,
  role,
  organization,
  send,
  apiError,
  readJson,
  forbidden,
}) {
  if (!path.startsWith('/api/v1/orders')) return false;
  const reply = (status, body) => {
    send(res, status, body);
    return true;
  };
  const manager = role === 'owner' || role === 'admin';
  if (role === 'viewer') {
    forbidden(res);
    return true;
  }
  const mine = orders.filter((o) => o.organizationId === orgId);

  if (path === '/api/v1/orders/settings') {
    if (!manager) {
      forbidden(res);
      return true;
    }
    if (req.method === 'PUT') {
      const body = await readJson(req);
      if (
        body.published &&
        (organization.hiddenModules ?? []).includes('orders')
      ) {
        apiError(res, 400, 'VALIDATION_FAILED', 'Données invalides.');
        return true;
      }
      settings[orgId] = body;
    }
    return reply(200, {
      ...settingsOf(orgId),
      slug: organization.slug,
      ordersThisMonth: mine.length,
      maxOrdersPerMonth: 30,
    });
  }
  if (path === '/api/v1/orders/counts')
    return reply(200, {
      new: mine.filter((o) => o.status === 'new').length,
      open: mine.filter((o) =>
        ['new', 'confirmed', 'shipping'].includes(o.status),
      ).length,
      remind: mine.filter(
        (o) => ['confirmed', 'shipping'].includes(o.status) && !o.paidAt,
      ).length,
    });
  if (path === '/api/v1/orders' && req.method === 'GET') {
    const view = url.searchParams.get('view') ?? 'open';
    const rows = mine.filter((o) =>
      view === 'new'
        ? o.status === 'new'
        : view === 'open'
          ? ['new', 'confirmed', 'shipping'].includes(o.status)
          : view === 'remind'
            ? ['confirmed', 'shipping'].includes(o.status) && !o.paidAt
            : true,
    );
    return reply(200, rows);
  }
  const match = /^\/api\/v1\/orders\/([^/]+)(?:\/(\w+))?$/.exec(path);
  if (!match) return false;
  const order = mine.find((o) => o.id === match[1]);
  if (!order) {
    apiError(res, 404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
    return true;
  }
  const action = match[2];
  if (!action && req.method === 'GET') return reply(200, order);
  if (req.method !== 'POST') return false;
  const body = await readJson(req);
  const now = new Date().toISOString();
  const move = (to) => {
    if (!NEXT[order.status].includes(to)) {
      apiError(res, 409, 'ORDER_WRONG_STEP', 'Étape impossible.');
      return false;
    }
    order.status = to;
    return true;
  };
  const pay = (payment) => {
    order.paidAt = now;
    order.payment = {
      method: payment.method,
      provider: payment.provider ?? null,
      reference: payment.reference ?? '',
    };
  };
  if (action === 'confirm' && move('confirmed')) order.confirmedAt = now;
  else if (action === 'ship' && move('shipping'))
    Object.assign(order, {
      shippedAt: now,
      courierName: body.courierName,
      courierPhone: body.courierPhone.replace(/\D/g, ''),
      deliveryFee: body.deliveryFee,
    });
  else if (action === 'pay') pay(body);
  else if (action === 'deliver') {
    if (!order.paidAt && !body.payment) {
      apiError(
        res,
        400,
        'VALIDATION_FAILED',
        'Indiquez comment le client a payé.',
      );
      return true;
    }
    if (!move('delivered')) return true;
    if (!order.paidAt) pay(body.payment);
    Object.assign(order, { deliveredAt: now, saleId: randomUUID() });
  } else if (action === 'cancel' && move('cancelled'))
    Object.assign(order, { cancelledAt: now, cancelReason: body.reason });
  else if (!['confirm', 'ship', 'cancel'].includes(action)) return false;
  if (res.headersSent) return true;
  return reply(201, order);
}
