import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

/** Archiving a shop or an account from the administration (ADR-074). */
describe('Archives', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let carol: TestUser; // seller of Acme
  let zed: TestUser; // platform administrator
  let acmeId: string;

  const bearer = (user: TestUser) => ({
    Authorization: `Bearer ${user.token}`,
  });
  const shop = (user: TestUser) => ({
    ...bearer(user),
    'X-Organization-Id': acmeId,
  });
  const admin = (path: string, user = zed) =>
    ctx.http().get(`/api/v1/admin${path}`).set(bearer(user));
  const adminPost = (path: string, body: object = {}, user = zed) =>
    ctx.http().post(`/api/v1/admin${path}`).set(bearer(user)).send(body);

  beforeAll(async () => {
    ctx = await createTestContext();
    [alice, carol, zed] = await Promise.all([
      ctx.createUser(),
      ctx.createUser(),
      ctx.platformAdmin(),
    ]);
    acmeId = (
      await ctx
        .http()
        .post('/api/v1/organizations')
        .set(bearer(alice))
        .send({ name: 'Acme Dakar' })
        .expect(201)
    ).body.id;
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member')`,
      [acmeId, carol.id],
    );
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('archives a shop: closed to its members, out of the lists, restorable', async () => {
    await adminPost(`/shops/${acmeId}/archive`, {}).expect(400); // no reason
    await adminPost(`/shops/${acmeId}/archive`, { reason: 'x' }, alice).expect(
      403,
    );
    const archived = (
      await adminPost(`/shops/${acmeId}/archive`, {
        reason: 'Boutique fermée',
      }).expect(200)
    ).body;
    expect(archived).toMatchObject({
      status: 'archived',
      archive: { reason: 'Boutique fermée' },
      suspension: null,
    });
    await ctx.http().get('/api/v1/products').set(shop(alice)).expect(404);
    const me = (
      await ctx.http().get('/api/v1/me').set(bearer(alice)).expect(200)
    ).body;
    expect(me.organizations).toEqual([]);
    const listed = (await admin('/shops').expect(200)).body as { id: string }[];
    expect(listed.map((s) => s.id)).not.toContain(acmeId);
    const asked = (await admin('/shops?status=archived').expect(200)).body as {
      id: string;
    }[];
    expect(asked.map((s) => s.id)).toContain(acmeId);
    // Nothing else changes on an archived shop.
    await adminPost(`/shops/${acmeId}/suspend`, { reason: 'x' }).expect(409);
    await adminPost(`/shops/${acmeId}/archive`, { reason: 'x' }).expect(409);

    await adminPost(`/shops/${acmeId}/restore`).expect(200);
    await ctx.http().get('/api/v1/products').set(shop(alice)).expect(200);
    const history = (
      await ctx
        .http()
        .get('/api/v1/audit-logs?limit=5')
        .set(shop(alice))
        .expect(200)
    ).body.data as { action: string }[];
    expect(history.map((h) => h.action)).toEqual(
      expect.arrayContaining([
        'organization.archived',
        'organization.restored',
      ]),
    );
  });

  it('archives an account: it opens nothing, its shop and history stay', async () => {
    const found = (
      await admin(`/users?q=${encodeURIComponent(carol.email)}`).expect(200)
    ).body as { id: string; shops: { id: string; role: string }[] }[];
    expect(found).toEqual([
      expect.objectContaining({
        id: carol.id,
        archived: null,
        shops: [expect.objectContaining({ id: acmeId, role: 'member' })],
      }),
    ]);
    const archived = (
      await adminPost(`/users/${carol.id}/archive`, {
        reason: 'A quitté la boutique',
      }).expect(200)
    ).body;
    expect(archived.archived).toMatchObject({ reason: 'A quitté la boutique' });
    const refused = await ctx
      .http()
      .get('/api/v1/me')
      .set(bearer(carol))
      .expect(403);
    expect(refused.body.error.code).toBe('ACCOUNT_ARCHIVED');
    await ctx.http().get('/api/v1/sales').set(shop(carol)).expect(403);
    // The shop and its owner are not affected.
    await ctx.http().get('/api/v1/sales').set(shop(alice)).expect(200);
    const archivedOnly = (await admin('/users?archived=true').expect(200))
      .body as { id: string }[];
    expect(archivedOnly.map((u) => u.id)).toEqual([carol.id]);

    await adminPost(`/users/${carol.id}/restore`).expect(200);
    await ctx.http().get('/api/v1/me').set(bearer(carol)).expect(200);
    await adminPost(`/users/${carol.id}/restore`).expect(409);
  });

  it('never archives the administration, and only the administration archives', async () => {
    const res = await adminPost(`/users/${zed.id}/archive`, {
      reason: 'x',
    }).expect(409);
    expect(res.body.error.code).toBe('PLATFORM_ADMIN_ACCOUNT');
    await adminPost(
      `/users/${carol.id}/archive`,
      { reason: 'x' },
      alice,
    ).expect(403);
    await admin('/users', alice).expect(403);
    await adminPost('/users/not-a-uuid/archive', { reason: 'x' }).expect(404);
  });
});
