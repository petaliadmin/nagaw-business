import { randomUUID } from 'node:crypto';
import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

describe('Feedback of the pilot shops', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex
  let carol: TestUser; // seller of Acme
  let dan: TestUser; // reader of Acme
  let zed: TestUser; // platform administrator
  let acmeId: string;
  let globexId: string;

  const headers = (user: TestUser, orgId?: string) => ({
    Authorization: `Bearer ${user.token}`,
    ...(orgId && { 'X-Organization-Id': orgId }),
  });
  const send = (user: TestUser, orgId: string, body: object = {}) =>
    ctx
      .http()
      .post('/api/v1/feedback')
      .set(headers(user, orgId))
      .send({
        kind: 'problem',
        message: 'Le ticket ne s’imprime pas',
        page: '/caisse',
        clientOperationId: randomUUID(),
        ...body,
      });
  const mine = async (user: TestUser, orgId: string) =>
    (
      await ctx
        .http()
        .get('/api/v1/feedback')
        .set(headers(user, orgId))
        .expect(200)
    ).body;

  beforeAll(async () => {
    ctx = await createTestContext();
    [alice, bob, carol, dan, zed] = await Promise.all([
      ctx.createUser(),
      ctx.createUser(),
      ctx.createUser(),
      ctx.createUser(),
      ctx.platformAdmin(),
    ]);
    const createOrg = async (user: TestUser, name: string) =>
      (
        await ctx
          .http()
          .post('/api/v1/organizations')
          .set(headers(user))
          .send({ name })
          .expect(201)
      ).body.id as string;
    acmeId = await createOrg(alice, 'Acme Dakar');
    globexId = await createOrg(bob, 'Globex');
    await ctx.setPlan(acmeId, 'pro');
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'viewer')`,
      [acmeId, carol.id, dan.id],
    );
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('lets anyone of a shop write, from the page they are on', async () => {
    const clientOperationId = randomUUID();
    const sent = await send(carol, acmeId, {
      page: '/caisse?jeton=secret#x',
      clientOperationId,
    }).expect(201);
    expect(sent.body).toMatchObject({
      kind: 'problem',
      page: '/caisse',
      status: 'new',
      answer: '',
    });
    await send(carol, acmeId, { page: '/caisse', clientOperationId }).expect(
      200,
    ); // replay
    await send(dan, acmeId, {
      kind: 'idea',
      message: 'Un export Excel',
    }).expect(201);
    await send(carol, acmeId, { message: '   ' }).expect(400);
    await send(carol, acmeId, { kind: 'autre' }).expect(400);
    // Each person sees what they sent, not the others' messages.
    expect(
      (await mine(carol, acmeId)).map((f: { kind: string }) => f.kind),
    ).toEqual(['problem']);
    expect(
      (await mine(dan, acmeId)).map((f: { kind: string }) => f.kind),
    ).toEqual(['idea']);
    expect(await mine(alice, acmeId)).toEqual([]);
  });

  it('lets the platform read every shop’s messages and answer them', async () => {
    await send(bob, globexId, {
      kind: 'question',
      message: 'Comment changer d’offre ?',
    }).expect(201);
    await ctx
      .http()
      .get('/api/v1/admin/feedback')
      .set(headers(alice))
      .expect(403);
    const all = (
      await ctx
        .http()
        .get('/api/v1/admin/feedback?status=new')
        .set(headers(zed))
        .expect(200)
    ).body;
    const ofAcme = all.filter(
      (f: { shop: { id: string } }) => f.shop.id === acmeId,
    );
    expect(ofAcme.map((f: { author: string }) => f.author).sort()).toEqual(
      [carol.email, dan.email].sort(),
    );
    const problem = ofAcme.find((f: { kind: string }) => f.kind === 'problem');

    const answered = (
      await ctx
        .http()
        .post(`/api/v1/admin/feedback/${problem.id}`)
        .set(headers(zed))
        .send({
          status: 'done',
          answer: 'Corrigé : réessayez après mise à jour.',
        })
        .expect(200)
    ).body;
    expect(answered).toMatchObject({
      status: 'done',
      answer: 'Corrigé : réessayez après mise à jour.',
    });
    expect(answered.answeredAt).not.toBeNull();
    // The author sees the answer.
    expect((await mine(carol, acmeId))[0]).toMatchObject({
      status: 'done',
      answer: 'Corrigé : réessayez après mise à jour.',
    });
    // A later status change keeps the answer.
    const reread = (
      await ctx
        .http()
        .post(`/api/v1/admin/feedback/${problem.id}`)
        .set(headers(zed))
        .send({ status: 'read' })
        .expect(200)
    ).body;
    expect(reread).toMatchObject({
      status: 'read',
      answer: 'Corrigé : réessayez après mise à jour.',
    });
    await ctx
      .http()
      .post(`/api/v1/admin/feedback/${randomUUID()}`)
      .set(headers(zed))
      .send({ status: 'read' })
      .expect(404);
    const history = (
      await ctx
        .http()
        .get('/api/v1/audit-logs?limit=1')
        .set(headers(alice, acmeId))
        .expect(200)
    ).body.data;
    expect(history[0]).toMatchObject({
      action: 'feedback.answered',
      actorType: 'platform_admin',
    });
  });

  it('keeps the messages of a shop to that shop', async () => {
    expect(
      (await mine(bob, globexId)).map((f: { message: string }) => f.message),
    ).toEqual(['Comment changer d’offre ?']);
    await send(bob, acmeId).expect(404);
    await ctx
      .http()
      .get('/api/v1/feedback')
      .set(headers(bob, acmeId))
      .expect(404);
  });

  it('keeps a message as it was sent, even in SQL', async () => {
    const { rows } = await ctx.admin.query(
      'select id from app.feedback where organization_id = $1 limit 1',
      [acmeId],
    );
    await expect(
      ctx.admin.query(`update app.feedback set message = 'x' where id = $1`, [
        rows[0].id,
      ]),
    ).rejects.toThrow(/kept as sent/);
    await expect(
      ctx.admin.query('delete from app.feedback where id = $1', [rows[0].id]),
    ).rejects.toThrow(/never deleted/);
  });
});
