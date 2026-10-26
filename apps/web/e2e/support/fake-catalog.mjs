// Catalogue and stock part of the fake API (see fake-backend.mjs). Same
// shared schemas and rules as the real API: roles, tenant isolation,
// idempotent creations, optimistic versions, stock as the sum of movements.
import { createHash, randomUUID } from 'node:crypto';
import {
  createCategorySchema,
  createProductSchema,
  createStockMovementSchema,
  createSupplierSchema,
  createTaxRateSchema,
  productListQuerySchema,
  quantityFitsUnit,
  roleHasPermission,
  stockLevel,
  updateCategorySchema,
  updateProductSchema,
  updateSupplierSchema,
  updateTaxRateSchema,
} from '@nagaw/shared';

const ACME = '11111111-1111-4111-8111-111111111111';
const AWA = 'aaaaaaaa-0000-4000-8000-000000000001';
const now = () => new Date().toISOString();

function seed() {
  const at = '2026-10-02T09:00:00.000Z';
  const ref = (id, fields) => ({
    id,
    organizationId: ACME,
    status: 'active',
    createdAt: at,
    updatedAt: at,
    ...fields,
  });
  const drinks = ref('cccccccc-0000-4000-8000-000000000001', {
    name: 'Boissons',
    color: 'stock',
  });
  const vat = ref('cccccccc-0000-4000-8000-000000000002', {
    name: 'TVA',
    rateBasisPoints: 1800,
  });
  const supplier = ref('cccccccc-0000-4000-8000-000000000003', {
    name: 'Grossiste Sandaga',
    phone: '77 000 00 00',
    notes: '',
  });
  const product = (id, fields) =>
    ref(id, {
      categoryId: null,
      unit: 'piece',
      purchasePrice: null,
      taxRateId: null,
      barcode: null,
      trackStock: true,
      lowStockThreshold: null,
      version: 1,
      photo: null,
      clientOperationId: randomUUID(),
      ...fields,
    });
  const water = product('dddddddd-0000-4000-8000-000000000001', {
    name: 'Eau minérale 1,5 L',
    categoryId: drinks.id,
    unit: 'bouteille',
    salePrice: 500,
    purchasePrice: 350,
    taxRateId: vat.id,
    lowStockThreshold: 6,
  });
  const soap = product('dddddddd-0000-4000-8000-000000000002', {
    name: 'Savon de Marseille',
    salePrice: 750,
    purchasePrice: 500,
    lowStockThreshold: 3,
  });
  return {
    categories: [drinks],
    taxRates: [vat],
    suppliers: [supplier],
    products: [water, soap],
    movements: [
      {
        id: randomUUID(),
        organizationId: ACME,
        productId: water.id,
        kind: 'initial',
        quantity: 24,
        countedQuantity: null,
        unitCost: 350,
        supplierId: null,
        reason: null,
        clientOperationId: water.clientOperationId,
        createdBy: AWA,
        occurredAt: at,
      },
    ],
  };
}

let catalog = seed();
export function resetCatalog() {
  catalog = seed();
}

/** For the sales part of the fake API (fake-sales.mjs). */
export const catalogState = () => catalog;

function validation(send, res, issues) {
  return reply(400, {
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Données invalides.',
      details: issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    },
  });
}

const stockOf = (productId) =>
  Math.round(
    catalog.movements
      .filter((m) => m.productId === productId)
      .reduce((sum, m) => sum + m.quantity, 0) * 1000,
  ) / 1000;

export function productDto(p) {
  const category = catalog.categories.find((c) => c.id === p.categoryId);
  const taxRate = catalog.taxRates.find((t) => t.id === p.taxRateId);
  const stock = {
    trackStock: p.trackStock,
    stockQuantity: stockOf(p.id),
    lowStockThreshold: p.lowStockThreshold,
  };
  return {
    id: p.id,
    name: p.name,
    category: category
      ? { id: category.id, name: category.name, color: category.color }
      : null,
    unit: p.unit,
    salePrice: p.salePrice,
    purchasePrice: p.purchasePrice,
    taxRate: taxRate
      ? {
          id: taxRate.id,
          name: taxRate.name,
          rateBasisPoints: taxRate.rateBasisPoints,
        }
      : null,
    barcode: p.barcode,
    ...stock,
    stockLevel: stockLevel(stock),
    status: p.status,
    version: p.version,
    photoVersion: p.photo?.sha256.slice(0, 16) ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function movementDto(m, userById) {
  const supplier = catalog.suppliers.find((s) => s.id === m.supplierId);
  return {
    id: m.id,
    kind: m.kind,
    quantity: m.quantity,
    countedQuantity: m.countedQuantity,
    unitCost: m.unitCost,
    supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
    reason: m.reason,
    createdBy: { userId: m.createdBy, email: userById(m.createdBy).email },
    occurredAt: m.occurredAt,
  };
}

const categoryDto = (c) => ({
  ...c,
  productCount: catalog.products.filter(
    (p) => p.categoryId === c.id && p.status === 'active',
  ).length,
  organizationId: undefined,
});
const plain = (item) => ({ ...item, organizationId: undefined });

const REFERENCES = {
  '/api/v1/tax-rates': {
    list: () => catalog.taxRates,
    create: createTaxRateSchema,
    update: updateTaxRateSchema,
    dto: plain,
    notFound: ['TAX_RATE_NOT_FOUND', 'Taxe introuvable.'],
    taken: 'Une taxe porte déjà ce nom.',
  },
  '/api/v1/product-categories': {
    list: () => catalog.categories,
    create: createCategorySchema,
    update: updateCategorySchema,
    dto: categoryDto,
    defaults: { color: 'brand' },
    notFound: ['CATEGORY_NOT_FOUND', 'Catégorie introuvable.'],
    taken: 'Une catégorie porte déjà ce nom.',
  },
  '/api/v1/suppliers': {
    list: () => catalog.suppliers,
    create: createSupplierSchema,
    update: updateSupplierSchema,
    dto: plain,
    notFound: ['SUPPLIER_NOT_FOUND', 'Fournisseur introuvable.'],
    taken: 'Un fournisseur porte déjà ce nom.',
  },
};

const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/**
 * Handles catalogue routes; returns false when the path is not one of them.
 * `ctx`: { req, res, path, url, user, orgId, canManage, send, apiError,
 * readJson, forbidden, userById }.
 */
export async function handleCatalog(ctx) {
  const { req, res, path, url, user, orgId, role, canManage, send, apiError } =
    ctx;
  const mine = (item) => item.organizationId === orgId;
  // Each answers the request and reports it as handled.
  const reply = (status, body) => {
    send(res, status, body);
    return true;
  };
  const fail = (status, code, message) => {
    apiError(res, status, code, message);
    return true;
  };
  const invalid = (issues) => {
    validation(send, res, issues);
    return true;
  };
  const deny = () => {
    ctx.forbidden(res);
    return true;
  };

  for (const [base, ref] of Object.entries(REFERENCES)) {
    if (path === base && req.method === 'GET') {
      send(res, 200, ref.list().filter(mine).map(ref.dto));
      return true;
    }
    if (path === base && req.method === 'POST') {
      if (!canManage) return deny();
      const parsed = ref.create.safeParse(await ctx.readJson(req));
      if (!parsed.success) return invalid(parsed.error.issues);
      const list = ref.list();
      if (
        list.some(
          (i) =>
            mine(i) &&
            i.status === 'active' &&
            sameName(i.name, parsed.data.name),
        )
      )
        return fail(409, 'NAME_TAKEN', ref.taken);
      const item = {
        id: randomUUID(),
        organizationId: orgId,
        status: 'active',
        createdAt: now(),
        updatedAt: now(),
        ...ref.defaults,
        ...parsed.data,
      };
      list.push(item);
      send(res, 201, ref.dto(item));
      return true;
    }
    const match = new RegExp(`^${base}/([^/]+)$`).exec(path);
    if (match && req.method === 'PATCH') {
      if (!canManage) return deny();
      const item = ref.list().find((i) => mine(i) && i.id === match[1]);
      if (!item) return fail(404, ...ref.notFound);
      const parsed = ref.update.safeParse(await ctx.readJson(req));
      if (!parsed.success) return invalid(parsed.error.issues);
      Object.assign(item, parsed.data, { updatedAt: now() });
      send(res, 200, ref.dto(item));
      return true;
    }
  }

  if (path === '/api/v1/stock/summary' && req.method === 'GET') {
    const products = catalog.products
      .filter((p) => mine(p) && p.status === 'active')
      .map(productDto);
    const tracked = products.filter((p) => p.trackStock);
    const alerts = tracked
      .filter((p) => p.stockLevel === 'out' || p.stockLevel === 'low')
      .sort(
        (a, b) =>
          (a.stockLevel === 'out' ? 0 : 1) - (b.stockLevel === 'out' ? 0 : 1) ||
          a.stockQuantity - b.stockQuantity,
      )
      .slice(0, 10)
      .map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        stockQuantity: p.stockQuantity,
        lowStockThreshold: p.lowStockThreshold,
        stockLevel: p.stockLevel,
      }));
    const inStock = tracked.filter((p) => p.stockQuantity > 0);
    send(res, 200, {
      trackedProducts: tracked.length,
      lowStock: tracked.filter((p) => p.stockLevel === 'low').length,
      outOfStock: tracked.filter((p) => p.stockLevel === 'out').length,
      stockValue: Math.round(
        inStock
          .filter((p) => p.purchasePrice !== null)
          .reduce((sum, p) => sum + p.stockQuantity * p.purchasePrice, 0),
      ),
      unvaluedProducts: inStock.filter((p) => p.purchasePrice === null).length,
      alerts,
    });
    return true;
  }

  if (path === '/api/v1/products' && req.method === 'GET') {
    const query = productListQuerySchema.safeParse(
      Object.fromEntries(url.searchParams),
    );
    if (!query.success) return invalid(query.error.issues);
    const { q, categoryId, stock, status } = query.data;
    const list = catalog.products
      .filter((p) => mine(p) && p.status === status)
      .filter((p) => !categoryId || p.categoryId === categoryId)
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.barcode === q,
      )
      .map(productDto)
      .filter(
        (p) =>
          !stock ||
          (stock === 'out'
            ? p.stockLevel === 'out'
            : p.stockLevel === 'out' || p.stockLevel === 'low'),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    send(res, 200, list);
    return true;
  }

  if (path === '/api/v1/products' && req.method === 'POST') {
    if (!canManage) return deny();
    const parsed = createProductSchema.safeParse(await ctx.readJson(req));
    if (!parsed.success) return invalid(parsed.error.issues);
    const input = parsed.data;
    const replay = catalog.products.find(
      (p) => mine(p) && p.clientOperationId === input.clientOperationId,
    );
    if (replay) return send(res, 200, productDto(replay));
    if (
      input.initialStock !== null &&
      !quantityFitsUnit(input.initialStock, input.unit)
    )
      return invalid([
        {
          path: ['initialStock'],
          message: 'Nombre entier attendu pour cette unité.',
        },
      ]);
    if (
      catalog.products.some(
        (p) => mine(p) && p.status === 'active' && sameName(p.name, input.name),
      )
    )
      return fail(409, 'NAME_TAKEN', 'Un produit porte déjà ce nom.');
    if (
      input.categoryId &&
      !catalog.categories.some((c) => mine(c) && c.id === input.categoryId)
    )
      return invalid([
        { path: ['categoryId'], message: 'Catégorie inconnue.' },
      ]);
    const { initialStock, ...fields } = input;
    const product = {
      id: randomUUID(),
      organizationId: orgId,
      status: 'active',
      version: 1,
      photo: null,
      createdAt: now(),
      updatedAt: now(),
      ...fields,
    };
    catalog.products.push(product);
    if (initialStock !== null) {
      catalog.movements.push({
        id: randomUUID(),
        organizationId: orgId,
        productId: product.id,
        kind: 'initial',
        quantity: initialStock,
        countedQuantity: null,
        unitCost: input.purchasePrice,
        supplierId: null,
        reason: null,
        clientOperationId: input.clientOperationId,
        createdBy: user.id,
        occurredAt: now(),
      });
    }
    send(res, 201, productDto(product));
    return true;
  }

  const productMatch =
    /^\/api\/v1\/products\/([^/]+)(\/(photo|movements))?$/.exec(path);
  if (!productMatch) return false;
  const product = catalog.products.find(
    (p) => mine(p) && p.id === productMatch[1],
  );
  if (!product) {
    apiError(res, 404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');
    return true;
  }
  const sub = productMatch[3];

  if (!sub && req.method === 'GET') return reply(200, productDto(product));
  if (!sub && req.method === 'PATCH') {
    if (!canManage) return deny();
    const parsed = updateProductSchema.safeParse(await ctx.readJson(req));
    if (!parsed.success) return invalid(parsed.error.issues);
    const { version, ...fields } = parsed.data;
    if (version !== product.version)
      return fail(
        409,
        'VERSION_CONFLICT',
        'Ce produit a été modifié entre-temps. Rechargez la page pour voir la dernière version.',
      );
    if (
      fields.name &&
      catalog.products.some(
        (p) =>
          mine(p) &&
          p.id !== product.id &&
          p.status === 'active' &&
          sameName(p.name, fields.name),
      )
    )
      return fail(409, 'NAME_TAKEN', 'Un produit porte déjà ce nom.');
    for (const [key, value] of Object.entries(fields))
      if (value !== undefined) product[key] = value;
    product.version += 1;
    product.updatedAt = now();
    send(res, 200, productDto(product));
    return true;
  }

  if (sub === 'photo') {
    if (req.method === 'GET') {
      if (!product.photo)
        return fail(404, 'PHOTO_NOT_FOUND', 'Ce produit n’a pas de photo.');
      res.writeHead(200, { 'content-type': product.photo.contentType });
      res.end(product.photo.data);
      return true;
    }
    if (!canManage) return deny();
    if (req.method === 'PUT') {
      const data = await readRaw(req);
      const contentType = req.headers['content-type'];
      if (
        !['image/webp', 'image/jpeg', 'image/png'].includes(contentType) ||
        data.length === 0
      )
        return invalid([
          { path: ['photo'], message: 'Envoyez une image WebP, JPEG ou PNG.' },
        ]);
      product.photo = {
        contentType,
        data,
        sha256: createHash('sha256').update(data).digest('hex'),
      };
      return reply(200, productDto(product));
    }
    if (req.method === 'DELETE') {
      product.photo = null;
      return reply(200, productDto(product));
    }
  }

  if (sub === 'movements' && req.method === 'GET') {
    send(
      res,
      200,
      catalog.movements
        .filter((m) => mine(m) && m.productId === product.id)
        .reverse()
        .map((m) => movementDto(m, ctx.userById)),
    );
    return true;
  }
  if (sub === 'movements' && req.method === 'POST') {
    // Sellers record deliveries only (ADR-036).
    if (!roleHasPermission(role, 'stock.receive')) return deny();
    const parsed = createStockMovementSchema.safeParse(await ctx.readJson(req));
    if (!parsed.success) return invalid(parsed.error.issues);
    const input = parsed.data;
    if (input.kind !== 'purchase' && !roleHasPermission(role, 'stock.move'))
      return deny();
    const previous = catalog.movements.find(
      (m) => mine(m) && m.clientOperationId === input.clientOperationId,
    );
    if (previous)
      return reply(200, {
        movement: movementDto(previous, ctx.userById),
        product: productDto(product),
      });
    if (!product.trackStock)
      return fail(
        409,
        'STOCK_NOT_TRACKED',
        'Le stock de ce produit n’est pas suivi.',
      );
    const current = stockOf(product.id);
    const amount =
      input.kind === 'inventory' ? input.countedQuantity : input.quantity;
    if (!quantityFitsUnit(amount, product.unit))
      return invalid([
        {
          path: [input.kind === 'inventory' ? 'countedQuantity' : 'quantity'],
          message: 'Nombre entier attendu pour cette unité.',
        },
      ]);
    if (input.kind === 'loss' && input.quantity > current)
      return fail(
        409,
        'STOCK_INSUFFICIENT',
        `Il ne reste que ${current} en stock. Faites un inventaire si ce chiffre est faux.`,
      );
    const quantity =
      input.kind === 'purchase'
        ? input.quantity
        : input.kind === 'loss'
          ? -input.quantity
          : Math.round((input.countedQuantity - current) * 1000) / 1000;
    const movement = {
      id: randomUUID(),
      organizationId: orgId,
      productId: product.id,
      kind: input.kind,
      quantity,
      countedQuantity:
        input.kind === 'inventory' ? input.countedQuantity : null,
      unitCost: input.kind === 'purchase' ? input.unitCost : null,
      supplierId: input.kind === 'purchase' ? input.supplierId : null,
      reason: input.kind === 'purchase' ? null : input.reason,
      clientOperationId: input.clientOperationId,
      createdBy: user.id,
      occurredAt: now(),
    };
    catalog.movements.push(movement);
    send(res, 201, {
      movement: movementDto(movement, ctx.userById),
      product: productDto(product),
    });
    return true;
  }
  apiError(res, 404, 'NOT_FOUND', 'Introuvable.');
  return true;
}
