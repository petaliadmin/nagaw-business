import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

/** Profile of the shop and the modules it shows (ADR-062). */
describe('Shop profile and modules', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex, stranger to Acme
  let carol: TestUser; // seller at Acme
  let acmeId: string;
  let globexId: string;

  const as = (user: TestUser, orgId: string) => ({
    Authorization: `Bearer ${user.token}`,
    'X-Organization-Id': orgId,
  });
  const answers = {
    sector: 'fashion_beauty',
    channels: ['social', 'delivery'],
    goals: ['profit'],
    teamSize: 'solo',
    offer: 'products',
    hiddenModules: ['documents', 'accounting'],
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    [alice, bob, carol] = await Promise.all([
      ctx.createUser(),
      ctx.createUser(),
      ctx.createUser(),
    ]);
    const create = async (user: TestUser, name: string) =>
      (
        await ctx
          .http()
          .post('/api/v1/organizations')
          .set({ Authorization: `Bearer ${user.token}` })
          .send({ name })
          .expect(201)
      ).body as { id: string; profileStatus: string; hiddenModules: string[] };
    const acme = await create(alice, 'Acme Mode');
    acmeId = acme.id;
    expect(acme.profileStatus).toBe('pending');
    // « Commandes » opens a public page: hidden until chosen (ADR-063).
    expect(acme.hiddenModules).toEqual(['orders']);
    globexId = (await create(bob, 'Globex')).id;
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member')`,
      [acmeId, carol.id],
    );
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('offers the answers kept in the database', async () => {
    const res = await ctx
      .http()
      .get('/api/v1/organizations/current/profile')
      .set(as(alice, acmeId))
      .expect(200);
    expect(res.body.status).toBe('pending');
    expect(res.body.sector).toBeNull();
    expect(res.body.choices.sectors[0]).toEqual({
      key: 'neighbourhood',
      label: 'Boutique de quartier',
      modules: ['suppliers', 'expenses', 'stats'],
    });
    expect(
      res.body.choices.goals.map((goal: { key: string }) => goal.key),
    ).toContain('accounting');
  });

  it('keeps an inactive answer out of the questionnaire and refuses it', async () => {
    await ctx.admin.query(
      `insert into app.profile_choices (kind, key, label, position, active)
       values ('sector', 'retired_sector', 'Ancienne activité', 99, false)`,
    );
    const res = await ctx
      .http()
      .get('/api/v1/organizations/current/profile')
      .set(as(alice, acmeId))
      .expect(200);
    expect(
      res.body.choices.sectors.map((sector: { key: string }) => sector.key),
    ).not.toContain('retired_sector');
    await ctx
      .http()
      .put('/api/v1/organizations/current/profile')
      .set(as(alice, acmeId))
      .send({ ...answers, sector: 'retired_sector' })
      .expect(400);
    const unknownGoal = await ctx
      .http()
      .put('/api/v1/organizations/current/profile')
      .set(as(alice, acmeId))
      .send({ ...answers, goals: ['profit', 'fly'] })
      .expect(400);
    expect(unknownGoal.body.error.details[0].path).toBe('goals.1');
  });

  it('counts the answers for the platform, naming no shop', async () => {
    const zed = await ctx.platformAdmin();
    const read = async () =>
      (
        await ctx
          .http()
          .get('/api/v1/admin/profiles')
          .set({ Authorization: `Bearer ${zed.token}` })
          .expect(200)
      ).body as {
        status: { pending: number; answered: number; skipped: number };
        sectors: { key: string; count: number }[];
        goals: { key: string; count: number }[];
        channels: { key: string; count: number }[];
      };
    const count = (list: { key: string; count: number }[], key: string) =>
      list.find((item) => item.key === key)?.count ?? 0;
    const before = await read();
    expect(JSON.stringify(before)).not.toContain(acmeId);

    const shop = (
      await ctx
        .http()
        .post('/api/v1/organizations')
        .set({ Authorization: `Bearer ${carol.token}` })
        .send({ name: 'Carol Quincaillerie' })
        .expect(201)
    ).body.id as string;
    await ctx
      .http()
      .put('/api/v1/organizations/current/profile')
      .set(as(carol, shop))
      .send({ ...answers, sector: 'hardware', goals: ['stock', 'documents'] })
      .expect(200);

    const after = await read();
    expect(count(after.sectors, 'hardware')).toBe(
      count(before.sectors, 'hardware') + 1,
    );
    expect(count(after.goals, 'stock')).toBe(count(before.goals, 'stock') + 1);
    expect(count(after.channels, 'social')).toBe(
      count(before.channels, 'social') + 1,
    );
    expect(after.status.answered).toBe(before.status.answered + 1);

    // A shop owner is not the platform.
    await ctx
      .http()
      .get('/api/v1/admin/profiles')
      .set({ Authorization: `Bearer ${alice.token}` })
      .expect(403);
  });

  it('saves the answers and the menu chosen, and records who did', async () => {
    const res = await ctx
      .http()
      .put('/api/v1/organizations/current/profile')
      .set(as(alice, acmeId))
      .send({ ...answers, hiddenModules: ['accounting', 'documents'] })
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'answered',
      sector: 'fashion_beauty',
      channels: ['social', 'delivery'],
      goals: ['profit'],
      teamSize: 'solo',
      offer: 'products',
      hiddenModules: ['documents', 'accounting'],
    });

    const shop = await ctx
      .http()
      .get('/api/v1/organizations/current')
      .set(as(alice, acmeId))
      .expect(200);
    expect(shop.body.profileStatus).toBe('answered');
    expect(shop.body.hiddenModules).toEqual(['documents', 'accounting']);

    const audit = await ctx.admin.query(
      `select actor_id, metadata from app.audit_logs
        where organization_id = $1 and action = 'organization.profile_answered'`,
      [acmeId],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].actor_id).toBe(alice.id);
    expect(audit.rows[0].metadata.hiddenModules).toEqual({
      from: ['orders'],
      to: ['documents', 'accounting'],
    });
  });

  it('hides a module without refusing its screens', async () => {
    // Accounting is hidden at Acme: the API still answers (ADR-062).
    await ctx
      .http()
      .get('/api/v1/accounting/journal')
      .set(as(alice, acmeId))
      .expect(200);
  });

  it('lets the settings show a module again', async () => {
    const res = await ctx
      .http()
      .put('/api/v1/organizations/current/modules')
      .set(as(alice, acmeId))
      .send({ hiddenModules: ['documents'] })
      .expect(200);
    expect(res.body.hiddenModules).toEqual(['documents']);
    expect(res.body.profileStatus).toBe('answered');
    await ctx
      .http()
      .put('/api/v1/organizations/current/modules')
      .set(as(alice, acmeId))
      .send({ hiddenModules: ['sales'] })
      .expect(400);
  });

  it('keeps the profile and the menu to the owner and managers', async () => {
    await ctx
      .http()
      .get('/api/v1/organizations/current/profile')
      .set(as(carol, acmeId))
      .expect(403);
    await ctx
      .http()
      .put('/api/v1/organizations/current/profile')
      .set(as(carol, acmeId))
      .send(answers)
      .expect(403);
    await ctx
      .http()
      .post('/api/v1/organizations/current/profile/skip')
      .set(as(carol, acmeId))
      .expect(403);
    await ctx
      .http()
      .put('/api/v1/organizations/current/modules')
      .set(as(carol, acmeId))
      .send({ hiddenModules: [] })
      .expect(403);
  });

  it('never reads nor changes another shop', async () => {
    // Bob names Acme: refused as if it did not exist.
    const headers = as(bob, acmeId);
    for (const request of [
      () =>
        ctx.http().get('/api/v1/organizations/current/profile').set(headers),
      () =>
        ctx
          .http()
          .put('/api/v1/organizations/current/profile')
          .set(headers)
          .send(answers),
      () =>
        ctx
          .http()
          .post('/api/v1/organizations/current/profile/skip')
          .set(headers),
      () =>
        ctx
          .http()
          .put('/api/v1/organizations/current/modules')
          .set(headers)
          .send({ hiddenModules: [] }),
    ]) {
      const res = await request().expect(404);
      expect(res.body.error.code).toBe('ORGANIZATION_NOT_FOUND');
    }

    // Bob's own shop is untouched by Acme's answers, and his do not reach it.
    await ctx
      .http()
      .put('/api/v1/organizations/current/modules')
      .set(as(bob, globexId))
      .send({ hiddenModules: ['stats'] })
      .expect(200);
    const globex = await ctx
      .http()
      .get('/api/v1/organizations/current/profile')
      .set(as(bob, globexId))
      .expect(200);
    expect(globex.body).toMatchObject({
      status: 'pending',
      sector: null,
      hiddenModules: ['stats'],
    });
    const acme = await ctx
      .http()
      .get('/api/v1/organizations/current/profile')
      .set(as(alice, acmeId))
      .expect(200);
    expect(acme.body.hiddenModules).toEqual(['documents']);
  });

  it('asks a skipped shop no more, without touching an answered one', async () => {
    const skipped = await ctx
      .http()
      .post('/api/v1/organizations/current/profile/skip')
      .set(as(bob, globexId))
      .expect(201);
    expect(skipped.body.profileStatus).toBe('skipped');

    const answered = await ctx
      .http()
      .post('/api/v1/organizations/current/profile/skip')
      .set(as(alice, acmeId))
      .expect(201);
    expect(answered.body.profileStatus).toBe('answered');
    const audit = await ctx.admin.query(
      `select count(*)::int as n from app.audit_logs
        where organization_id = $1 and action = 'organization.profile_skipped'`,
      [acmeId],
    );
    expect(audit.rows[0].n).toBe(0);
  });
});
