import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

describe('Agents', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex, stranger to Acme
  let carol: TestUser; // member of Acme
  let acmeId: string;
  let globexId: string;

  const as = (user: TestUser, orgId?: string) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${user.token}`,
    };
    if (orgId) headers['X-Organization-Id'] = orgId;
    return headers;
  };

  const configuration = {
    instructions: 'Relancer les devis sans réponse depuis sept jours.',
    objectives: 'Aucun devis sans suivi.',
    maxSteps: 10,
    maxDurationSeconds: 120,
    errorPolicy: 'escalate',
    tools: [],
  };

  const create = (
    user: TestUser,
    orgId: string,
    overrides: Record<string, unknown> = {},
  ) =>
    ctx
      .http()
      .post('/api/v1/agents')
      .set(as(user, orgId))
      .send({
        name: 'Agent commercial',
        description: 'Suivi des devis',
        roleKey: 'sales',
        configuration,
        ...overrides,
      });

  async function auditOf(organizationId: string, action: string) {
    const { rows } = await ctx.admin.query<{
      actor_id: string;
      target_id: string;
      metadata: Record<string, unknown>;
    }>(
      `select actor_id, target_id, metadata from app.audit_logs
       where organization_id = $1 and action = $2 order by id`,
      [organizationId, action],
    );
    return rows;
  }

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
        .send({ name: 'Acme Dakar' })
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
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('creation and reading', () => {
    let agentId: string;

    it('creates a draft agent with version 1, audited', async () => {
      const res = await create(alice, acmeId).expect(201);
      agentId = res.body.id;
      expect(res.body).toEqual(
        expect.objectContaining({
          name: 'Agent commercial',
          roleKey: 'sales',
          status: 'draft',
          currentVersion: expect.objectContaining({
            version: 1,
            instructions: configuration.instructions,
            maxSteps: 10,
            errorPolicy: 'escalate',
            tools: [],
            createdBy: { userId: alice.id, email: alice.email },
          }),
        }),
      );
      const [entry] = await auditOf(acmeId, 'agent.created');
      expect(entry).toEqual({
        actor_id: alice.id,
        target_id: agentId,
        metadata: { name: 'Agent commercial', roleKey: 'sales' },
      });
    });

    it('lets members read but not create or change agents', async () => {
      const list = await ctx
        .http()
        .get('/api/v1/agents')
        .set(as(carol, acmeId))
        .expect(200);
      expect(list.body.map((a: { id: string }) => a.id)).toEqual([agentId]);
      await ctx
        .http()
        .get(`/api/v1/agents/${agentId}`)
        .set(as(carol, acmeId))
        .expect(200);
      expect(
        (await create(carol, acmeId, { name: 'Autre' }).expect(403)).body.error
          .code,
      ).toBe('PERMISSION_DENIED');
      await ctx
        .http()
        .post(`/api/v1/agents/${agentId}/status`)
        .set(as(carol, acmeId))
        .send({ status: 'active' })
        .expect(403);
    });

    it('validates input and refuses server-owned fields', async () => {
      const short = await create(alice, acmeId, { name: 'A' }).expect(400);
      expect(short.body.error.code).toBe('VALIDATION_FAILED');
      await create(alice, acmeId, { name: 'X Agent', status: 'active' }).expect(
        400,
      );
      await create(alice, acmeId, {
        name: 'X Agent',
        configuration: { ...configuration, model: 'gpt-x' },
      }).expect(400);
      await create(alice, acmeId, {
        name: 'X Agent',
        configuration: { ...configuration, tools: ['shell.exec'] },
      }).expect(400);
    });

    it('refuses tools that are not available yet', async () => {
      const res = await create(alice, acmeId, {
        name: 'Agent e-mail',
        configuration: { ...configuration, tools: ['email.send'] },
      }).expect(400);
      expect(res.body.error.details).toEqual([
        { path: 'tools.0', message: expect.stringContaining('pas encore') },
      ]);
    });

    it('enforces unique names among non-archived agents', async () => {
      const res = await create(alice, acmeId, {
        name: 'AGENT COMMERCIAL',
      }).expect(409);
      expect(res.body.error.code).toBe('AGENT_NAME_TAKEN');
    });
  });

  describe('caps configured for the organization', () => {
    it('applies the step and duration caps', async () => {
      await ctx.admin.query(
        `update app.organizations
         set agent_max_steps = 5, agent_max_duration_seconds = 60
         where id = $1`,
        [acmeId],
      );
      const res = await create(alice, acmeId, { name: 'Trop gourmand' }).expect(
        400,
      );
      expect(
        res.body.error.details.map((d: { path: string }) => d.path),
      ).toEqual(['maxSteps', 'maxDurationSeconds']);
      const limits = await ctx
        .http()
        .get('/api/v1/agents/limits')
        .set(as(carol, acmeId))
        .expect(200);
      expect(limits.body).toEqual({
        maxAgents: 10,
        maxSteps: 5,
        maxDurationSeconds: 60,
      });
      await ctx.admin.query(
        `update app.organizations
         set agent_max_steps = 20, agent_max_duration_seconds = 300
         where id = $1`,
        [acmeId],
      );
    });

    it('applies the agent count cap, archived agents excluded', async () => {
      await ctx.admin.query(
        'update app.organizations set max_agents = 1 where id = $1',
        [acmeId],
      );
      const res = await create(alice, acmeId, { name: 'Deuxième' }).expect(409);
      expect(res.body.error.code).toBe('AGENT_LIMIT_REACHED');
      await ctx.admin.query(
        'update app.organizations set max_agents = 10 where id = $1',
        [acmeId],
      );
    });
  });

  describe('configuration, versions and status', () => {
    let agentId: string;

    beforeAll(async () => {
      agentId = (
        await create(alice, acmeId, {
          name: 'Agent finance',
          roleKey: 'finance',
          configuration: { ...configuration, instructions: 'À compléter' },
        }).expect(201)
      ).body.id;
    });

    const configure = (body: Record<string, unknown>, user = alice) =>
      ctx
        .http()
        .post(`/api/v1/agents/${agentId}/versions`)
        .set(as(user, acmeId))
        .send(body);
    const setStatus = (status: string) =>
      ctx
        .http()
        .post(`/api/v1/agents/${agentId}/status`)
        .set(as(alice, acmeId))
        .send({ status });

    it('reports readiness without calling any model', async () => {
      const report = await ctx
        .http()
        .post(`/api/v1/agents/${agentId}/test`)
        .set(as(carol, acmeId))
        .expect(200);
      expect(report.body.ready).toBe(false);
      expect(report.body.testedVersion).toBe(1);
      expect(report.body.checks.map((c: { code: string }) => c.code)).toEqual([
        'INSTRUCTIONS_TOO_SHORT',
        'NO_AI_MODEL',
        'NO_TOOLS',
      ]);
      expect(report.body.brief).toContain('Agent : Agent finance (Finance)');
    });

    it('refuses to activate an incomplete agent', async () => {
      const res = await setStatus('active').expect(409);
      expect(res.body.error.code).toBe('AGENT_NOT_READY');
      expect(res.body.error.details[0].path).toBe('INSTRUCTIONS_TOO_SHORT');
    });

    it('appends a version for each configuration change, never rewriting history', async () => {
      const res = await configure(configuration).expect(201);
      expect(res.body.currentVersion.version).toBe(2);
      const unchanged = await configure(configuration).expect(409);
      expect(unchanged.body.error.code).toBe('CONFIGURATION_UNCHANGED');

      const versions = await ctx
        .http()
        .get(`/api/v1/agents/${agentId}/versions`)
        .set(as(carol, acmeId))
        .expect(200);
      expect(versions.body.map((v: { version: number }) => v.version)).toEqual([
        2, 1,
      ]);
      expect(versions.body[1].instructions).toBe('À compléter');
      expect(
        (await auditOf(acmeId, 'agent.configured')).map((e) => e.metadata),
      ).toEqual([{ version: 2, previousVersion: 1 }]);

      // Even the table owner cannot rewrite a version.
      await expect(
        ctx.admin.query(
          `update app.agent_versions set instructions = 'x' where agent_id = $1`,
          [agentId],
        ),
      ).rejects.toThrow(/append-only/);
    });

    it('follows the life cycle and keeps an active agent ready', async () => {
      expect((await setStatus('active').expect(200)).body.status).toBe(
        'active',
      );
      const broken = await configure({
        ...configuration,
        objectives: '',
      }).expect(409);
      expect(broken.body.error.code).toBe('AGENT_NOT_READY');
      expect((await setStatus('suspended').expect(200)).body.status).toBe(
        'suspended',
      );
      const invalid = await setStatus('draft').expect(409);
      expect(invalid.body.error.code).toBe('INVALID_STATUS_TRANSITION');
      expect(
        (await auditOf(acmeId, 'agent.status_changed')).map((e) => e.metadata),
      ).toEqual([
        { from: 'draft', to: 'active' },
        { from: 'active', to: 'suspended' },
      ]);
    });

    it('updates the identity with an exact audit of the changes', async () => {
      const res = await ctx
        .http()
        .patch(`/api/v1/agents/${agentId}`)
        .set(as(alice, acmeId))
        .send({ name: 'Agent trésorerie', description: 'Suivi de trésorerie' })
        .expect(200);
      expect(res.body.name).toBe('Agent trésorerie');
      expect(
        (await auditOf(acmeId, 'agent.updated')).map((e) => e.metadata),
      ).toEqual([
        {
          changes: {
            name: { from: 'Agent finance', to: 'Agent trésorerie' },
            description: { from: 'Suivi des devis', to: 'Suivi de trésorerie' },
          },
        },
      ]);
    });

    it('makes archiving final and hides archived agents by default', async () => {
      await setStatus('archived').expect(200);
      await setStatus('active').expect(409);
      expect(
        (await configure({ ...configuration, maxSteps: 3 }).expect(409)).body
          .error.code,
      ).toBe('AGENT_ARCHIVED');
      await ctx
        .http()
        .patch(`/api/v1/agents/${agentId}`)
        .set(as(alice, acmeId))
        .send({ name: 'Renommé' })
        .expect(409);
      const visible = await ctx
        .http()
        .get('/api/v1/agents')
        .set(as(alice, acmeId))
        .expect(200);
      expect(visible.body.map((a: { id: string }) => a.id)).not.toContain(
        agentId,
      );
      const all = await ctx
        .http()
        .get('/api/v1/agents?archives=true')
        .set(as(alice, acmeId))
        .expect(200);
      expect(all.body.map((a: { id: string }) => a.id)).toContain(agentId);
      // The name is free again.
      await create(alice, acmeId, { name: 'Agent trésorerie' }).expect(201);
    });
  });

  describe('isolation between organizations', () => {
    let acmeAgent: string;

    beforeAll(async () => {
      acmeAgent = (
        await create(alice, acmeId, { name: 'Agent confidentiel' }).expect(201)
      ).body.id;
    });

    it('answers 404 to a stranger, in reading and in writing', async () => {
      const attempts = [
        () => ctx.http().get('/api/v1/agents').set(as(bob, acmeId)),
        () => create(bob, acmeId, { name: 'Intrus' }),
        () =>
          ctx.http().get(`/api/v1/agents/${acmeAgent}`).set(as(bob, acmeId)),
      ];
      for (const attempt of attempts) {
        const res = await attempt().expect(404);
        expect(res.body.error.code).toBe('ORGANIZATION_NOT_FOUND');
      }
    });

    it('hides another organization’s agent behind the caller’s own tenant', async () => {
      const attempts = [
        () =>
          ctx.http().get(`/api/v1/agents/${acmeAgent}`).set(as(bob, globexId)),
        () =>
          ctx
            .http()
            .get(`/api/v1/agents/${acmeAgent}/versions`)
            .set(as(bob, globexId)),
        () =>
          ctx
            .http()
            .patch(`/api/v1/agents/${acmeAgent}`)
            .set(as(bob, globexId))
            .send({ name: 'Volé' }),
        () =>
          ctx
            .http()
            .post(`/api/v1/agents/${acmeAgent}/versions`)
            .set(as(bob, globexId))
            .send({ ...configuration, maxSteps: 2 }),
        () =>
          ctx
            .http()
            .post(`/api/v1/agents/${acmeAgent}/status`)
            .set(as(bob, globexId))
            .send({ status: 'archived' }),
        () =>
          ctx
            .http()
            .post(`/api/v1/agents/${acmeAgent}/test`)
            .set(as(bob, globexId)),
        () =>
          ctx.http().get('/api/v1/agents/not-a-uuid').set(as(bob, globexId)),
      ];
      for (const attempt of attempts) {
        const res = await attempt().expect(404);
        expect(res.body.error.code).toBe('AGENT_NOT_FOUND');
      }
      const globexList = await ctx
        .http()
        .get('/api/v1/agents?archives=true')
        .set(as(bob, globexId))
        .expect(200);
      expect(globexList.body).toEqual([]);
      const { rows } = await ctx.admin.query(
        'select name, status from app.agents where id = $1',
        [acmeAgent],
      );
      expect(rows[0]).toEqual({ name: 'Agent confidentiel', status: 'draft' });
    });

    it('cannot attach a version to an agent of another organization', async () => {
      await expect(
        ctx.admin.query(
          `insert into app.agent_versions
             (organization_id, agent_id, version, instructions, objectives,
              max_steps, max_duration_seconds, error_policy, created_by)
           values ($1, $2, 99, 'x', 'y', 1, 10, 'stop', $3)`,
          [globexId, acmeAgent, bob.id],
        ),
      ).rejects.toThrow(/foreign key/);
    });
  });
});
