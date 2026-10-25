import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

describe('Invitations and member management', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex, stranger to Acme
  let carol: TestUser; // member of Acme
  let dave: TestUser; // admin of Acme
  let erin: TestUser; // invitee, no organization yet
  let frank: TestUser; // another user without organization
  let acmeId: string;
  let globexId: string;

  const as = (user: TestUser, orgId?: string) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${user.token}`,
    };
    if (orgId) headers['X-Organization-Id'] = orgId;
    return headers;
  };

  const invite = (
    user: TestUser,
    orgId: string,
    email: string,
    role = 'member',
  ) =>
    ctx
      .http()
      .post('/api/v1/organizations/current/invitations')
      .set(as(user, orgId))
      .send({ email, role });

  const accept = (user: TestUser, token: string) =>
    ctx.http().post('/api/v1/invitations/accept').set(as(user)).send({ token });

  const preview = (user: TestUser, token: string) =>
    ctx
      .http()
      .post('/api/v1/invitations/preview')
      .set(as(user))
      .send({ token });

  const patchMember = (
    user: TestUser,
    orgId: string,
    targetId: string,
    body: Record<string, unknown>,
  ) =>
    ctx
      .http()
      .patch(`/api/v1/organizations/current/members/${targetId}`)
      .set(as(user, orgId))
      .send(body);

  async function auditActions(organizationId: string, action: string) {
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
    [alice, bob, carol, dave, erin, frank] = await Promise.all([
      ctx.createUser(),
      ctx.createUser(),
      ctx.createUser(),
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
    // A team bigger than the free offer allows.
    await ctx.setPlan(acmeId, 'pro');
    await ctx.setPlan(globexId, 'pro');
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'admin')`,
      [acmeId, carol.id, dave.id],
    );
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('creating invitations', () => {
    let erinToken: string;

    it('returns a one-time token and stores only its hash', async () => {
      const before = Date.now();
      const res = await invite(
        alice,
        acmeId,
        ` ${erin.email.toUpperCase()} `,
      ).expect(201);
      erinToken = res.body.token;
      expect(erinToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(res.body.invitation).toEqual(
        expect.objectContaining({
          email: erin.email,
          role: 'member',
          status: 'pending',
          invitedBy: { userId: alice.id, email: alice.email },
        }),
      );
      // Default lifetime: 168 hours, read from the organization.
      const ttl = Date.parse(res.body.invitation.expiresAt) - before;
      expect(ttl).toBeGreaterThan(167 * 3600_000);
      expect(ttl).toBeLessThan(169 * 3600_000);

      const { rows } = await ctx.admin.query(
        `select encode(token_hash, 'hex') as hash from app.organization_invitations
         where id = $1`,
        [res.body.invitation.id],
      );
      expect(rows[0].hash).toHaveLength(64);
      expect(JSON.stringify(rows)).not.toContain(erinToken);

      const [entry] = await auditActions(acmeId, 'invitation.created');
      expect(entry).toEqual({
        actor_id: alice.id,
        target_id: res.body.invitation.id,
        metadata: { email: erin.email, role: 'member' },
      });
      expect(JSON.stringify(entry)).not.toContain(erinToken);
    });

    it('lists pending invitations for managers only', async () => {
      const list = await ctx
        .http()
        .get('/api/v1/organizations/current/invitations')
        .set(as(dave, acmeId))
        .expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0].email).toBe(erin.email);
      expect(list.body[0]).not.toHaveProperty('token');

      const denied = await ctx
        .http()
        .get('/api/v1/organizations/current/invitations')
        .set(as(carol, acmeId))
        .expect(403);
      expect(denied.body.error.code).toBe('PERMISSION_DENIED');
      await invite(carol, acmeId, frank.email).expect(403);
    });

    it('refuses duplicates, existing members and the owner role', async () => {
      expect(
        (await invite(alice, acmeId, erin.email).expect(409)).body.error.code,
      ).toBe('INVITATION_PENDING');
      expect(
        (await invite(dave, acmeId, carol.email.toUpperCase()).expect(409)).body
          .error.code,
      ).toBe('ALREADY_MEMBER');
      const owner = await invite(alice, acmeId, frank.email, 'owner').expect(
        400,
      );
      expect(owner.body.error.code).toBe('VALIDATION_FAILED');
      // Mass assignment: the organization comes from the verified header.
      await ctx
        .http()
        .post('/api/v1/organizations/current/invitations')
        .set(as(alice, acmeId))
        .send({ email: frank.email, role: 'member', organizationId: globexId })
        .expect(400);
    });

    it('lets the invitee preview, then join with the invited role', async () => {
      const seen = await preview(erin, erinToken).expect(200);
      expect(seen.body).toEqual({
        organizationName: 'Acme Dakar',
        email: erin.email,
        role: 'member',
        status: 'pending',
        expiresAt: expect.any(String),
        emailMatches: true,
      });

      const joined = await accept(erin, erinToken).expect(201);
      expect(joined.body).toEqual(
        expect.objectContaining({ id: acmeId, role: 'member' }),
      );
      const me = await ctx.http().get('/api/v1/me').set(as(erin)).expect(200);
      expect(me.body.organizations.map((o: { id: string }) => o.id)).toEqual([
        acmeId,
      ]);

      expect(await auditActions(acmeId, 'invitation.accepted')).toEqual([
        expect.objectContaining({ actor_id: erin.id }),
      ]);

      // Single use.
      expect((await accept(erin, erinToken).expect(409)).body.error.code).toBe(
        'INVITATION_ALREADY_USED',
      );
      expect((await preview(erin, erinToken).expect(200)).body.status).toBe(
        'accepted',
      );
      const list = await ctx
        .http()
        .get('/api/v1/organizations/current/invitations')
        .set(as(alice, acmeId))
        .expect(200);
      expect(list.body).toEqual([]);
    });
  });

  describe('accepting invitations', () => {
    it('binds the invitation to the invited e-mail address', async () => {
      const { token } = (await invite(alice, acmeId, frank.email).expect(201))
        .body;
      expect((await preview(erin, token).expect(200)).body.emailMatches).toBe(
        false,
      );
      const res = await accept(erin, token).expect(403);
      expect(res.body.error.code).toBe('INVITATION_EMAIL_MISMATCH');
      await accept(frank, token).expect(201);
    });

    it('rejects unknown and malformed tokens without leaking anything', async () => {
      const unknown = await accept(frank, 'A'.repeat(43)).expect(404);
      expect(unknown.body.error.code).toBe('INVITATION_NOT_FOUND');
      await preview(frank, 'A'.repeat(43)).expect(404);
      const malformed = await accept(frank, 'not-a-token').expect(400);
      expect(malformed.body.error.code).toBe('VALIDATION_FAILED');
      await ctx
        .http()
        .post('/api/v1/invitations/accept')
        .send({ token: 'A'.repeat(43) })
        .expect(401);
    });

    it('refuses revoked and expired invitations', async () => {
      const grace = await ctx.createUser();
      const created = (await invite(dave, acmeId, grace.email).expect(201))
        .body;
      const revoked = await ctx
        .http()
        .post(
          `/api/v1/organizations/current/invitations/${created.invitation.id}/revoke`,
        )
        .set(as(dave, acmeId))
        .expect(200);
      expect(revoked.body.status).toBe('revoked');
      expect(
        (await accept(grace, created.token).expect(410)).body.error.code,
      ).toBe('INVITATION_REVOKED');
      expect(
        (
          await ctx
            .http()
            .post(
              `/api/v1/organizations/current/invitations/${created.invitation.id}/revoke`,
            )
            .set(as(dave, acmeId))
            .expect(409)
        ).body.error.code,
      ).toBe('INVITATION_NOT_PENDING');
      const [entry] = await auditActions(acmeId, 'invitation.revoked');
      expect(entry).toEqual(
        expect.objectContaining({
          actor_id: dave.id,
          target_id: created.invitation.id,
        }),
      );

      const again = (await invite(dave, acmeId, grace.email).expect(201)).body;
      await ctx.admin.query(
        `update app.organization_invitations
         set created_at = now() - interval '2 days',
             expires_at = now() - interval '1 day'
         where id = $1`,
        [again.invitation.id],
      );
      expect((await preview(grace, again.token).expect(200)).body.status).toBe(
        'expired',
      );
      expect(
        (await accept(grace, again.token).expect(410)).body.error.code,
      ).toBe('INVITATION_EXPIRED');
      // An expired invitation no longer blocks a new one.
      const fresh = (await invite(dave, acmeId, grace.email).expect(201)).body;
      await accept(grace, fresh.token).expect(201);
    });

    it('uses the lifetime and the limit configured for the organization', async () => {
      await ctx
        .http()
        .patch('/api/v1/organizations/current')
        .set(as(alice, acmeId))
        .send({ invitationTtlHours: 24 })
        .expect(200);
      const henry = await ctx.createUser();
      const before = Date.now();
      const res = await invite(alice, acmeId, henry.email).expect(201);
      const ttl = Date.parse(res.body.invitation.expiresAt) - before;
      expect(ttl).toBeGreaterThan(23 * 3600_000);
      expect(ttl).toBeLessThan(25 * 3600_000);

      await ctx.admin.query(
        'update app.organizations set max_pending_invitations = 1 where id = $1',
        [acmeId],
      );
      const limited = await invite(alice, acmeId, 'other@example.test').expect(
        409,
      );
      expect(limited.body.error.code).toBe('INVITATION_LIMIT_REACHED');
      await ctx.admin.query(
        'update app.organizations set max_pending_invitations = 50 where id = $1',
        [acmeId],
      );
    });
  });

  describe('managing members', () => {
    it('lets an owner change a role, with an audit entry', async () => {
      const res = await patchMember(alice, acmeId, carol.id, {
        role: 'viewer',
      }).expect(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          userId: carol.id,
          role: 'viewer',
          status: 'active',
        }),
      );
      const [entry] = await auditActions(acmeId, 'member.role_changed');
      expect(entry).toEqual({
        actor_id: alice.id,
        target_id: carol.id,
        metadata: { email: carol.email, from: 'member', to: 'viewer' },
      });
    });

    it('lets an admin disable and reactivate a member', async () => {
      await patchMember(dave, acmeId, erin.id, { status: 'disabled' }).expect(
        200,
      );
      // Access is cut immediately.
      await ctx
        .http()
        .get('/api/v1/organizations/current')
        .set(as(erin, acmeId))
        .expect(404);
      const me = await ctx.http().get('/api/v1/me').set(as(erin)).expect(200);
      expect(me.body.organizations).toEqual([]);
      // A disabled member is not re-invited: they are reactivated.
      expect(
        (await invite(dave, acmeId, erin.email).expect(409)).body.error.code,
      ).toBe('ALREADY_MEMBER');

      await patchMember(dave, acmeId, erin.id, { status: 'active' }).expect(
        200,
      );
      await ctx
        .http()
        .get('/api/v1/organizations/current')
        .set(as(erin, acmeId))
        .expect(200);
      expect(await auditActions(acmeId, 'member.disabled')).toHaveLength(1);
      expect(await auditActions(acmeId, 'member.reactivated')).toHaveLength(1);
    });

    it('protects owners from admins and forbids self-changes', async () => {
      const protectedOwner = await patchMember(dave, acmeId, alice.id, {
        status: 'disabled',
      }).expect(403);
      expect(protectedOwner.body.error.code).toBe('OWNER_PROTECTED');
      const promotion = await patchMember(dave, acmeId, carol.id, {
        role: 'owner',
      }).expect(403);
      expect(promotion.body.error.code).toBe('OWNER_PROMOTION_FORBIDDEN');
      const self = await patchMember(alice, acmeId, alice.id, {
        role: 'admin',
      }).expect(403);
      expect(self.body.error.code).toBe('SELF_CHANGE_FORBIDDEN');
      // Members cannot manage anyone.
      await patchMember(carol, acmeId, erin.id, { role: 'admin' }).expect(403);
    });

    it('validates the change', async () => {
      await patchMember(alice, acmeId, carol.id, {}).expect(400);
      await patchMember(alice, acmeId, carol.id, { role: 'god' }).expect(400);
      await patchMember(alice, acmeId, carol.id, {
        role: 'admin',
        organizationId: globexId,
      }).expect(400);
    });

    it('keeps at least one active owner, even outside the API', async () => {
      await expect(
        ctx.admin.query(
          `update app.organization_memberships set role = 'admin'
           where organization_id = $1 and user_id = $2`,
          [acmeId, alice.id],
        ),
      ).rejects.toThrow(/no active owner/);

      // With a second owner, ownership can be handed over.
      await patchMember(alice, acmeId, dave.id, { role: 'owner' }).expect(200);
      await patchMember(dave, acmeId, alice.id, { role: 'admin' }).expect(200);
      await patchMember(dave, acmeId, alice.id, { role: 'owner' }).expect(200);
    });
  });

  describe('isolation between organizations', () => {
    it('hides another organization’s invitations', async () => {
      const acmeInvite = (
        await invite(alice, acmeId, 'isolated@example.test').expect(201)
      ).body.invitation;

      // A stranger naming Acme gets the same 404 as for a missing tenant.
      const attempts = [
        () =>
          ctx
            .http()
            .get('/api/v1/organizations/current/invitations')
            .set(as(bob, acmeId)),
        () => invite(bob, acmeId, 'x@example.test'),
        () =>
          ctx
            .http()
            .post(
              `/api/v1/organizations/current/invitations/${acmeInvite.id}/revoke`,
            )
            .set(as(bob, acmeId)),
      ];
      for (const attempt of attempts) {
        const res = await attempt().expect(404);
        expect(res.body.error.code).toBe('ORGANIZATION_NOT_FOUND');
      }

      // Through his own organization, Acme's invitation does not exist.
      const crossRevoke = await ctx
        .http()
        .post(
          `/api/v1/organizations/current/invitations/${acmeInvite.id}/revoke`,
        )
        .set(as(bob, globexId))
        .expect(404);
      expect(crossRevoke.body.error.code).toBe('INVITATION_NOT_FOUND');
      const globexList = await ctx
        .http()
        .get('/api/v1/organizations/current/invitations')
        .set(as(bob, globexId))
        .expect(200);
      expect(globexList.body).toEqual([]);
      const { rows } = await ctx.admin.query(
        'select status from app.organization_invitations where id = $1',
        [acmeInvite.id],
      );
      expect(rows[0].status).toBe('pending');
    });

    it('hides another organization’s members', async () => {
      const stranger = await patchMember(bob, acmeId, carol.id, {
        status: 'disabled',
      }).expect(404);
      expect(stranger.body.error.code).toBe('ORGANIZATION_NOT_FOUND');
      const cross = await patchMember(bob, globexId, carol.id, {
        status: 'disabled',
      }).expect(404);
      expect(cross.body.error.code).toBe('MEMBER_NOT_FOUND');
      await patchMember(bob, globexId, 'not-a-uuid', {
        status: 'disabled',
      }).expect(404);
      const { rows } = await ctx.admin.query(
        `select status from app.organization_memberships
         where organization_id = $1 and user_id = $2`,
        [acmeId, carol.id],
      );
      expect(rows[0].status).toBe('active');
    });
  });
});
