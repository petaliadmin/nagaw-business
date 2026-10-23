import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

describe('Responsibilities', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex, stranger to Acme
  let carol: TestUser; // member of Acme
  let acmeId: string;
  let globexId: string;
  let activeAgent: string;
  let draftAgent: string;
  let globexAgent: string;

  const as = (user: TestUser, orgId?: string) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${user.token}`,
    };
    if (orgId) headers['X-Organization-Id'] = orgId;
    return headers;
  };

  const agentConfiguration = {
    instructions: 'Relancer les devis sans réponse depuis sept jours.',
    objectives: 'Aucun devis sans suivi.',
    maxSteps: 10,
    maxDurationSeconds: 120,
    errorPolicy: 'stop',
    tools: [],
  };

  async function createAgent(user: TestUser, orgId: string, name: string) {
    const res = await ctx
      .http()
      .post('/api/v1/agents')
      .set(as(user, orgId))
      .send({
        name,
        description: '',
        roleKey: 'sales',
        configuration: agentConfiguration,
      })
      .expect(201);
    return res.body.id as string;
  }

  const body = (overrides: Record<string, unknown> = {}) => ({
    agentId: activeAgent,
    title: 'Relance des devis',
    objective: 'Aucun devis sans suivi.',
    scope: 'Devis de moins de 5 000 000 XOF',
    rules: 'Ne jamais relancer plus de deux fois.',
    successCriteria: 'Chaque devis relancé sous sept jours.',
    maxRunsPerDay: 4,
    escalationUserId: null,
    startsOn: null,
    endsOn: null,
    ...overrides,
  });

  const create = (user: TestUser, orgId: string, overrides = {}) =>
    ctx
      .http()
      .post('/api/v1/responsibilities')
      .set(as(user, orgId))
      .send(body(overrides));

  beforeAll(async () => {
    ctx = await createTestContext();
    [alice, bob, carol] = await Promise.all([
      ctx.createUser(),
      ctx.createUser(),
      ctx.createUser(),
    ]);
    acmeId = (
      await ctx
        .http()
        .post('/api/v1/organizations')
        .set(as(alice))
        .send({ name: 'Acme Dakar', timezone: 'Africa/Dakar' })
        .expect(201)
    ).body.id;
    globexId = (
      await ctx
        .http()
        .post('/api/v1/organizations')
        .set(as(bob))
        .send({ name: 'Globex' })
        .expect(201)
    ).body.id;
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member')`,
      [acmeId, carol.id],
    );
    activeAgent = await createAgent(alice, acmeId, 'Agent commercial');
    await ctx
      .http()
      .post(`/api/v1/agents/${activeAgent}/status`)
      .set(as(alice, acmeId))
      .send({ status: 'active' })
      .expect(200);
    draftAgent = await createAgent(alice, acmeId, 'Agent brouillon');
    globexAgent = await createAgent(bob, globexId, 'Agent Globex');
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('creation', () => {
    let id: string;

    it('creates a draft linked to the agent', async () => {
      const res = await create(alice, acmeId).expect(201);
      id = res.body.id;
      expect(res.body).toEqual(
        expect.objectContaining({
          title: 'Relance des devis',
          status: 'draft',
          agent: {
            id: activeAgent,
            name: 'Agent commercial',
            status: 'active',
          },
          maxRunsPerDay: 4,
          escalation: null,
        }),
      );
      const history = await ctx
        .http()
        .get(`/api/v1/responsibilities/${id}/history`)
        .set(as(carol, acmeId))
        .expect(200);
      expect(history.body).toEqual([
        expect.objectContaining({
          action: 'responsibility.created',
          actor: { userId: alice.id, email: alice.email },
        }),
      ]);
    });

    it('lists by agent and lets members read but not write', async () => {
      const byAgent = await ctx
        .http()
        .get(`/api/v1/responsibilities?agentId=${activeAgent}`)
        .set(as(carol, acmeId))
        .expect(200);
      expect(byAgent.body.map((r: { id: string }) => r.id)).toEqual([id]);
      const other = await ctx
        .http()
        .get(`/api/v1/responsibilities?agentId=${draftAgent}`)
        .set(as(carol, acmeId))
        .expect(200);
      expect(other.body).toEqual([]);
      expect((await create(carol, acmeId).expect(403)).body.error.code).toBe(
        'PERMISSION_DENIED',
      );
    });

    it('validates the period, refuses schedules and server-owned fields', async () => {
      const period = await create(alice, acmeId, {
        startsOn: '2026-12-01',
        endsOn: '2026-11-01',
      }).expect(400);
      expect(period.body.error.details[0].path).toBe('endsOn');
      // Fully manual application (ADR-017): no schedule is accepted.
      await create(alice, acmeId, {
        trigger: { type: 'schedule', frequency: 'daily', time: '08:30' },
      }).expect(400);
      await create(alice, acmeId, { status: 'active' }).expect(400);
      await create(alice, acmeId, { organizationId: globexId }).expect(400);
    });

    it('checks the agent, the escalation contact and the caps', async () => {
      const foreignAgent = await create(alice, acmeId, {
        agentId: globexAgent,
      }).expect(400);
      expect(foreignAgent.body.error.details).toEqual([
        { path: 'agentId', message: 'Agent introuvable.' },
      ]);
      const stranger = await create(alice, acmeId, {
        escalationUserId: bob.id,
      }).expect(400);
      expect(stranger.body.error.details[0].path).toBe('escalationUserId');
      await create(alice, acmeId, { escalationUserId: carol.id }).expect(201);

      const runs = await create(alice, acmeId, { maxRunsPerDay: 100 }).expect(
        400,
      );
      expect(runs.body.error.details[0].path).toBe('maxRunsPerDay');
      await ctx.admin.query(
        'update app.organizations set max_responsibilities = 2 where id = $1',
        [acmeId],
      );
      expect((await create(alice, acmeId).expect(409)).body.error.code).toBe(
        'RESPONSIBILITY_LIMIT_REACHED',
      );
      await ctx.admin.query(
        'update app.organizations set max_responsibilities = 50 where id = $1',
        [acmeId],
      );
    });
  });

  describe('life cycle and history', () => {
    let id: string;
    const setStatus = (status: string) =>
      ctx
        .http()
        .post(`/api/v1/responsibilities/${id}/status`)
        .set(as(alice, acmeId))
        .send({ status });
    const update = (overrides: Record<string, unknown>) =>
      ctx
        .http()
        .put(`/api/v1/responsibilities/${id}`)
        .set(as(alice, acmeId))
        .send(body(overrides));

    beforeAll(async () => {
      id = (
        await create(alice, acmeId, {
          agentId: draftAgent,
          successCriteria: '',
        }).expect(201)
      ).body.id;
    });

    it('refuses activation while the agent is not active or criteria are missing', async () => {
      const res = await setStatus('active').expect(409);
      expect(res.body.error.code).toBe('RESPONSIBILITY_NOT_READY');
      expect(
        res.body.error.details.map((d: { path: string }) => d.path),
      ).toEqual(['AGENT_NOT_ACTIVE', 'SUCCESS_CRITERIA_MISSING']);
    });

    it('records each update with the exact changes', async () => {
      await update({}).expect(200);
      const history = await ctx
        .http()
        .get(`/api/v1/responsibilities/${id}/history`)
        .set(as(alice, acmeId))
        .expect(200);
      expect(history.body[0].action).toBe('responsibility.updated');
      expect(history.body[0].metadata.changes).toEqual({
        agentId: { from: draftAgent, to: activeAgent },
        successCriteria: {
          from: '',
          to: 'Chaque devis relancé sous sept jours.',
        },
      });
    });

    it('activates, keeps an active responsibility complete, suspends', async () => {
      expect((await setStatus('active').expect(200)).body.status).toBe(
        'active',
      );
      const broken = await update({
        objective: '',
      }).expect(409);
      expect(broken.body.error.code).toBe('RESPONSIBILITY_NOT_READY');
      expect((await setStatus('suspended').expect(200)).body.status).toBe(
        'suspended',
      );
      expect((await setStatus('draft').expect(409)).body.error.code).toBe(
        'INVALID_STATUS_TRANSITION',
      );
    });

    it('makes archiving final', async () => {
      await setStatus('archived').expect(200);
      expect((await update({}).expect(409)).body.error.code).toBe(
        'RESPONSIBILITY_ARCHIVED',
      );
      await setStatus('active').expect(409);
      const visible = await ctx
        .http()
        .get('/api/v1/responsibilities')
        .set(as(alice, acmeId))
        .expect(200);
      expect(visible.body.map((r: { id: string }) => r.id)).not.toContain(id);
    });

    it('refuses an archived agent', async () => {
      await ctx
        .http()
        .post(`/api/v1/agents/${draftAgent}/status`)
        .set(as(alice, acmeId))
        .send({ status: 'archived' })
        .expect(200);
      const res = await create(alice, acmeId, { agentId: draftAgent }).expect(
        400,
      );
      expect(res.body.error.details[0].message).toBe('Cet agent est archivé.');
    });
  });

  describe('isolation between organizations', () => {
    let acmeResponsibility: string;

    beforeAll(async () => {
      acmeResponsibility = (await create(alice, acmeId).expect(201)).body.id;
    });

    it('answers 404 to a stranger naming the organization', async () => {
      for (const attempt of [
        () => ctx.http().get('/api/v1/responsibilities').set(as(bob, acmeId)),
        () => create(bob, acmeId),
      ]) {
        const res = await attempt().expect(404);
        expect(res.body.error.code).toBe('ORGANIZATION_NOT_FOUND');
      }
    });

    it('hides the responsibility behind the caller’s own tenant', async () => {
      const path = `/api/v1/responsibilities/${acmeResponsibility}`;
      for (const attempt of [
        () => ctx.http().get(path).set(as(bob, globexId)),
        () => ctx.http().get(`${path}/history`).set(as(bob, globexId)),
        () =>
          ctx
            .http()
            .put(path)
            .set(as(bob, globexId))
            .send(body({ agentId: globexAgent })),
        () =>
          ctx
            .http()
            .post(`${path}/status`)
            .set(as(bob, globexId))
            .send({ status: 'archived' }),
        () =>
          ctx
            .http()
            .get('/api/v1/responsibilities/nope')
            .set(as(bob, globexId)),
      ]) {
        const res = await attempt().expect(404);
        expect(res.body.error.code).toBe('RESPONSIBILITY_NOT_FOUND');
      }
      const globexList = await ctx
        .http()
        .get(`/api/v1/responsibilities?agentId=${activeAgent}&archives=true`)
        .set(as(bob, globexId))
        .expect(200);
      expect(globexList.body).toEqual([]);
      const { rows } = await ctx.admin.query(
        'select status, agent_id from app.responsibilities where id = $1',
        [acmeResponsibility],
      );
      expect(rows[0]).toEqual({ status: 'draft', agent_id: activeAgent });
    });

    it('cannot link a responsibility to another organization’s agent, even in SQL', async () => {
      await expect(
        ctx.admin.query(
          `insert into app.responsibilities
             (organization_id, agent_id, title, max_runs_per_day, created_by)
           values ($1, $2, 'Intrusion', 1, $3)`,
          [acmeId, globexAgent, alice.id],
        ),
      ).rejects.toThrow(/foreign key/);
    });
  });
});
