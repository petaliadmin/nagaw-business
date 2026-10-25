import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

interface Route {
  method: string;
  path: string;
}

/**
 * Routes that act on no shop, each with its own guard. Every other route is
 * a shop's: it must refuse a stranger to the shop. A new route lands here
 * only on purpose.
 */
const NOT_SHOP_SCOPED: Record<string, 'public' | 'user' | 'admin'> = {
  'GET /api/v1/health': 'public',
  'GET /api/v1/health/ready': 'public',
  'GET /api/v1/me': 'user',
  'POST /api/v1/organizations': 'user',
  'POST /api/v1/invitations/preview': 'user',
  'POST /api/v1/invitations/accept': 'user',
  'GET /api/v1/plans': 'user',
  'GET /api/v1/stats/shops': 'user',
};

/** API documentation: public, and not served in production (Phase 1). */
const isDocs = (route: Route) => route.path.startsWith('/api/v1/docs');
/** The answer to unknown paths (404), for every method. */
const isFallback = (route: Route) => route.path.includes('*');

/** Every route of the running application, from the Express router. */
function routesOf(ctx: TestContext): Route[] {
  const express = ctx.app.getHttpAdapter().getInstance() as {
    router: {
      stack: { route?: { path: string; methods: Record<string, boolean> } }[];
    };
  };
  return express.router.stack.flatMap((layer) =>
    layer.route
      ? Object.keys(layer.route.methods)
          .filter((m) => m !== '_all')
          .map((m) => ({ method: m.toUpperCase(), path: layer.route!.path }))
      : [],
  );
}

describe('Inventory of the API routes', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex, a stranger to Acme
  let acmeId: string;
  let routes: Route[];

  beforeAll(async () => {
    ctx = await createTestContext();
    [alice, bob] = await Promise.all([ctx.createUser(), ctx.createUser()]);
    const createOrg = async (user: TestUser, name: string) =>
      (
        await ctx
          .http()
          .post('/api/v1/organizations')
          .set({ Authorization: `Bearer ${user.token}` })
          .send({ name })
          .expect(201)
      ).body.id as string;
    acmeId = await createOrg(alice, 'Acme Dakar');
    await createOrg(bob, 'Globex');
    routes = routesOf(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  const call = (route: Route, headers: Record<string, string>) => {
    // Any id: the guards answer before the route reads it.
    const path = route.path.replace(/:[A-Za-z]+/g, randomUUID());
    const request = ctx.http()[route.method.toLowerCase() as 'get'](path);
    return request.set(headers).send({});
  };

  it('finds the routes of every module', () => {
    expect(routes.length).toBeGreaterThan(100);
    const keys = routes.map((r) => `${r.method} ${r.path}`);
    for (const known of [
      'POST /api/v1/sales',
      'POST /api/v1/sync',
      'GET /api/v1/invoices/:id/pdf',
      'GET /api/v1/accounting/journal.csv',
      'GET /api/v1/admin/overview',
    ])
      expect(keys).toContain(known);
  });

  it('closes every route but the health checks to a request without session', async () => {
    for (const route of routes) {
      const key = `${route.method} ${route.path}`;
      if (
        NOT_SHOP_SCOPED[key] === 'public' ||
        isDocs(route) ||
        isFallback(route)
      )
        continue;
      const res = await call(route, {});
      expect({ key, status: res.status }).toEqual({ key, status: 401 });
    }
  }, 60_000);

  it('refuses every route of a shop to someone who is not its member', async () => {
    for (const route of routes) {
      const key = `${route.method} ${route.path}`;
      if (
        NOT_SHOP_SCOPED[key] ||
        isDocs(route) ||
        isFallback(route) ||
        route.path.startsWith('/api/v1/admin/')
      )
        continue;
      const res = await call(route, {
        Authorization: `Bearer ${bob.token}`,
        'X-Organization-Id': acmeId,
      });
      expect({ key, status: res.status, code: res.body?.error?.code }).toEqual({
        key,
        status: 404,
        code: 'ORGANIZATION_NOT_FOUND',
      });
    }
  }, 120_000);

  it('keeps the administration to platform administrators', async () => {
    const admin = routes.filter((r) => r.path.startsWith('/api/v1/admin/'));
    expect(admin.length).toBeGreaterThan(5);
    for (const route of admin) {
      // A shop owner, even with the header of their own shop.
      const res = await call(route, {
        Authorization: `Bearer ${alice.token}`,
        'X-Organization-Id': acmeId,
      });
      expect({
        key: `${route.method} ${route.path}`,
        status: res.status,
      }).toEqual({
        key: `${route.method} ${route.path}`,
        status: 403,
      });
    }
  });

  it('lists every route without shop on purpose', () => {
    const keys = new Set(routes.map((r) => `${r.method} ${r.path}`));
    for (const key of Object.keys(NOT_SHOP_SCOPED)) expect(keys).toContain(key);
  });
});
