import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

describe('Organizations, memberships and tenant isolation', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex, stranger to Acme
  let carol: TestUser; // plain member of Acme
  let acmeId: string;
  let globexId: string;

  const as = (user: TestUser, orgId?: string) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${user.token}`,
    };
    if (orgId) headers['X-Organization-Id'] = orgId;
    return headers;
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    [alice, bob, carol] = await Promise.all([
      ctx.createUser(),
      ctx.createUser(),
      ctx.createUser(),
    ]);

    const acme = await ctx
      .http()
      .post('/api/v1/organizations')
      .set(as(alice))
      .send({ name: 'Acme Dakar', timezone: 'Africa/Dakar' })
      .expect(201);
    acmeId = acme.body.id;

    const globex = await ctx
      .http()
      .post('/api/v1/organizations')
      .set(as(bob))
      .send({ name: 'Globex' })
      .expect(201);
    globexId = globex.body.id;

    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member')`,
      [acmeId, carol.id],
    );
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('authentication', () => {
    it('rejects requests without a token', async () => {
      const res = await ctx.http().get('/api/v1/me').expect(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      await ctx
        .http()
        .post('/api/v1/organizations')
        .send({ name: 'X Corp' })
        .expect(401);
    });

    it('rejects a malformed authorization header', async () => {
      await ctx
        .http()
        .get('/api/v1/me')
        .set('Authorization', 'Basic abc')
        .expect(401);
    });

    it('keeps health endpoints public', async () => {
      await ctx.http().get('/api/v1/health').expect(200);
      const res = await ctx.http().get('/api/v1/health/ready').expect(200);
      expect(res.body).toEqual({
        status: 'ready',
        database: 'ok',
        auth: 'ok',
      });
    });
  });

  describe('organization creation', () => {
    it('makes the creator owner and lists it in /me', async () => {
      const res = await ctx.http().get('/api/v1/me').set(as(alice)).expect(200);
      expect(res.body.email).toBe(alice.email);
      expect(res.body.organizations).toEqual([
        expect.objectContaining({
          id: acmeId,
          name: 'Acme Dakar',
          role: 'owner',
          timezone: 'Africa/Dakar',
          defaultCurrency: 'XOF',
        }),
      ]);
    });

    it('records organization.created in the audit log', async () => {
      const { rows } = await ctx.admin.query(
        `select actor_id, action, target_id from app.audit_logs
         where organization_id = $1 and action = 'organization.created'`,
        [acmeId],
      );
      expect(rows).toEqual([
        {
          actor_id: alice.id,
          action: 'organization.created',
          target_id: acmeId,
        },
      ]);
    });

    it('validates input server-side', async () => {
      const short = await ctx
        .http()
        .post('/api/v1/organizations')
        .set(as(alice))
        .send({ name: 'A' })
        .expect(400);
      expect(short.body.error.code).toBe('VALIDATION_FAILED');
      expect(short.body.error.details[0].path).toBe('name');

      // Mass assignment: clients cannot set server-owned fields.
      await ctx
        .http()
        .post('/api/v1/organizations')
        .set(as(alice))
        .send({ name: 'Acme 2', status: 'suspended', created_by: bob.id })
        .expect(400);
    });
  });

  describe('tenant resolution', () => {
    it('requires a valid X-Organization-Id header', async () => {
      const missing = await ctx
        .http()
        .get('/api/v1/organizations/current')
        .set(as(alice))
        .expect(400);
      expect(missing.body.error.code).toBe('ORGANIZATION_HEADER_INVALID');
      await ctx
        .http()
        .get('/api/v1/organizations/current')
        .set({ ...as(alice), 'X-Organization-Id': 'not-a-uuid' })
        .expect(400);
    });

    it('serves the organization to its owner', async () => {
      const res = await ctx
        .http()
        .get('/api/v1/organizations/current')
        .set(as(alice, acmeId))
        .expect(200);
      expect(res.body.name).toBe('Acme Dakar');
    });
  });

  describe('isolation between organizations', () => {
    const tenantRoutes = [
      ['get', '/api/v1/organizations/current'],
      ['get', '/api/v1/organizations/current/members'],
      ['get', '/api/v1/audit-logs'],
    ] as const;

    it.each(tenantRoutes)(
      'answers 404 to a non-member on %s %s',
      async (method, path) => {
        const res = await ctx
          .http()
          [method](path)
          .set(as(bob, acmeId))
          .expect(404);
        expect(res.body.error.code).toBe('ORGANIZATION_NOT_FOUND');
      },
    );

    it('answers the same 404 for an organization that does not exist', async () => {
      const res = await ctx
        .http()
        .get('/api/v1/organizations/current')
        .set(as(bob, '00000000-0000-4000-8000-000000000000'))
        .expect(404);
      expect(res.body.error.code).toBe('ORGANIZATION_NOT_FOUND');
    });

    it('prevents a non-member from modifying another organization', async () => {
      await ctx
        .http()
        .patch('/api/v1/organizations/current')
        .set(as(bob, acmeId))
        .send({ name: 'Hijacked' })
        .expect(404);
      const { rows } = await ctx.admin.query(
        'select name from app.organizations where id = $1',
        [acmeId],
      );
      expect(rows[0].name).toBe('Acme Dakar');
    });

    it('never lists another organization in /me', async () => {
      const res = await ctx.http().get('/api/v1/me').set(as(bob)).expect(200);
      expect(res.body.organizations.map((o: { id: string }) => o.id)).toEqual([
        globexId,
      ]);
    });

    it('does not leak audit entries across organizations', async () => {
      const res = await ctx
        .http()
        .get('/api/v1/audit-logs')
        .set(as(bob, globexId))
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const entry of res.body.data) {
        expect(entry.targetId).not.toBe(acmeId);
      }
    });
  });

  describe('role-based permissions', () => {
    it('lets a member read but not update the organization', async () => {
      await ctx
        .http()
        .get('/api/v1/organizations/current')
        .set(as(carol, acmeId))
        .expect(200);
      const members = await ctx
        .http()
        .get('/api/v1/organizations/current/members')
        .set(as(carol, acmeId))
        .expect(200);
      expect(members.body.map((m: { role: string }) => m.role).sort()).toEqual([
        'member',
        'owner',
      ]);

      const denied = await ctx
        .http()
        .patch('/api/v1/organizations/current')
        .set(as(carol, acmeId))
        .send({ name: 'Renamed by member' })
        .expect(403);
      expect(denied.body.error.code).toBe('PERMISSION_DENIED');
      await ctx
        .http()
        .get('/api/v1/audit-logs')
        .set(as(carol, acmeId))
        .expect(403);
    });

    it('cuts access as soon as a membership is disabled', async () => {
      const dave = await ctx.createUser();
      await ctx.admin.query(
        `insert into app.organization_memberships (organization_id, user_id, role, status)
         values ($1, $2, 'admin', 'disabled')`,
        [acmeId, dave.id],
      );
      await ctx
        .http()
        .get('/api/v1/organizations/current')
        .set(as(dave, acmeId))
        .expect(404);
    });

    it('denies access to a suspended organization', async () => {
      const erin = await ctx.createUser();
      const created = await ctx
        .http()
        .post('/api/v1/organizations')
        .set(as(erin))
        .send({ name: 'Suspended Co' })
        .expect(201);
      await ctx.admin.query(
        `update app.organizations
            set status = 'suspended', suspended_at = now(), suspension_reason = 'Test'
          where id = $1`,
        [created.body.id],
      );
      await ctx
        .http()
        .get('/api/v1/organizations/current')
        .set(as(erin, created.body.id))
        .expect(404);
    });
  });

  describe('organization update and audit trail', () => {
    it('updates as owner and records the exact changes', async () => {
      const res = await ctx
        .http()
        .patch('/api/v1/organizations/current')
        .set(as(alice, acmeId))
        .send({ name: 'Acme Sénégal', defaultCurrency: 'EUR' })
        .expect(200);
      expect(res.body).toMatchObject({
        name: 'Acme Sénégal',
        defaultCurrency: 'EUR',
      });

      const audit = await ctx
        .http()
        .get('/api/v1/audit-logs?limit=1')
        .set(as(alice, acmeId))
        .expect(200);
      expect(audit.body.data).toHaveLength(1);
      expect(audit.body.data[0]).toMatchObject({
        action: 'organization.updated',
        actorType: 'user',
        actorId: alice.id,
        metadata: {
          changes: {
            name: { from: 'Acme Dakar', to: 'Acme Sénégal' },
            defaultCurrency: { from: 'XOF', to: 'EUR' },
          },
        },
      });
      expect(audit.body.data[0].requestId).toBeTruthy();
      expect(audit.body.nextCursor).toBe(audit.body.data[0].id);

      const next = await ctx
        .http()
        .get(`/api/v1/audit-logs?limit=1&cursor=${audit.body.nextCursor}`)
        .set(as(alice, acmeId))
        .expect(200);
      expect(next.body.data[0].action).toBe('organization.created');
      expect(next.body.nextCursor).toBeNull();
    });

    it('rejects an empty or invalid patch', async () => {
      await ctx
        .http()
        .patch('/api/v1/organizations/current')
        .set(as(alice, acmeId))
        .send({})
        .expect(400);
      await ctx
        .http()
        .patch('/api/v1/organizations/current')
        .set(as(alice, acmeId))
        .send({ timezone: 'Nowhere/City' })
        .expect(400);
    });
  });
});
