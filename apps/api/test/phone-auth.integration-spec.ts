import type { TestContext, TestUser } from './support/app.js';
import { createTestContext, randomPhone } from './support/app.js';

describe('Phone number and secret code (ADR-058)', () => {
  let ctx: TestContext;

  const signIn = (phone: string, pin: string) =>
    ctx.http().post('/api/v1/auth/phone/sign-in').send({ phone, pin });
  const signUp = (phone: string, pin: string) =>
    ctx.http().post('/api/v1/auth/phone/sign-up').send({ phone, pin });
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function failures(phone: string) {
    const { rows } = await ctx.admin.query<{
      failures: number;
      locked: boolean;
    }>(
      `select failures, coalesce(locked_until > now(), false) as locked
         from app.phone_sign_in_failures where phone = $1`,
      [phone],
    );
    return rows[0];
  }

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('creating an account', () => {
    it('opens a session and fills the profile with the number', async () => {
      const phone = randomPhone();
      const res = await signUp(phone, '1357').expect(201);
      expect(res.body).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });

      const me = await ctx
        .http()
        .get('/api/v1/me')
        .set(bearer(res.body.accessToken))
        .expect(200);
      expect(me.body).toEqual(
        expect.objectContaining({ phone, email: '', organizations: [] }),
      );
      const { rows } = await ctx.admin.query(
        'select contact from app.user_profiles where phone = $1',
        [phone],
      );
      expect(rows).toEqual([{ contact: `+${phone}` }]);
    });

    it('never gives Supabase the code itself', async () => {
      const phone = randomPhone();
      await signUp(phone, '2580').expect(201);
      const stored = [...ctx.authAdmin.passwords.values()];
      expect(stored).not.toContain('2580');
      expect(stored.every((p) => p.startsWith('Ng1-'))).toBe(true);
    });

    it('refuses a number already used, a guessable code, a bad number', async () => {
      const phone = randomPhone();
      await signUp(phone, '1357').expect(201);
      expect((await signUp(phone, '2468').expect(409)).body.error.code).toBe(
        'PHONE_TAKEN',
      );
      expect(
        (await signUp(randomPhone(), '1234').expect(400)).body.error.code,
      ).toBe('VALIDATION_FAILED');
      await signUp(randomPhone(), '0000').expect(400);
      await signUp('77 123 45 67', '1357').expect(400);
      await signUp(randomPhone(), '13579').expect(400);
    });
  });

  describe('signing in', () => {
    it('opens a session with the right code, refuses a wrong one', async () => {
      const phone = randomPhone();
      await signUp(phone, '4826').expect(201);
      const ok = await signIn(phone, '4826').expect(200);
      expect(ok.body.accessToken).toEqual(expect.any(String));
      const wrong = await signIn(phone, '4827').expect(401);
      expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(wrong.body.error.message).toContain('Encore 4 essais');
      // An unknown number answers exactly like a wrong code.
      const unknown = await signIn(randomPhone(), '4826').expect(401);
      expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('locks the number after the configured failures, then lets it in again', async () => {
      const phone = randomPhone();
      await signUp(phone, '9157').expect(201);
      for (let i = 1; i < 5; i++) await signIn(phone, '0001').expect(401);
      const last = await signIn(phone, '0001').expect(429);
      expect(last.body.error.code).toBe('PHONE_LOCKED');
      // Locked: even the right code is refused, and not tried.
      expect((await signIn(phone, '9157').expect(429)).body.error.code).toBe(
        'PHONE_LOCKED',
      );
      expect(await failures(phone)).toEqual({ failures: 5, locked: true });

      // The lock is over: the next attempt starts again from zero.
      await ctx.admin.query(
        `update app.phone_sign_in_failures
            set locked_until = now() - interval '1 second'
          where phone = $1`,
        [phone],
      );
      await signIn(phone, '9157').expect(200);
      expect(await failures(phone)).toEqual({ failures: 0, locked: false });
    });

    it('cannot be beaten by attempts sent all at once', async () => {
      const phone = randomPhone();
      await signUp(phone, '3071').expect(201);
      const codes = Array.from({ length: 12 }, (_, i) =>
        String(1000 + i).padStart(4, '0'),
      );
      const statuses = (
        await Promise.all(codes.map((pin) => signIn(phone, pin)))
      ).map((r) => r.status);
      // At most five codes were tried; the others were refused unread.
      expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(5);
      expect(statuses.every((s) => s === 401 || s === 429)).toBe(true);
      await signIn(phone, '3071').expect(429);
    });

    it('reads its thresholds from the platform settings', async () => {
      await ctx.admin.query(
        'update app.platform_settings set pin_max_failures = 3',
      );
      try {
        const phone = randomPhone();
        await signUp(phone, '5813').expect(201);
        await signIn(phone, '0001').expect(401);
        await signIn(phone, '0001').expect(401);
        await signIn(phone, '0001').expect(429);
      } finally {
        await ctx.admin.query(
          'update app.platform_settings set pin_max_failures = 5',
        );
      }
    });

    it('does not count a code Supabase could not check', async () => {
      const phone = randomPhone();
      await signUp(phone, '6142').expect(201);
      await signIn(phone, '0001').expect(401);
      ctx.authAdmin.setOutage(true);
      try {
        const down = await signIn(phone, '6142').expect(500);
        expect(down.body.error.code).toBe('INTERNAL_ERROR');
      } finally {
        ctx.authAdmin.setOutage(false);
      }
      expect(await failures(phone)).toEqual({ failures: 1, locked: false });
    });
  });

  describe('moving an e-mail account to a number', () => {
    it('gives the account a number and a code, once', async () => {
      const ama: TestUser = await ctx.createUser();
      const phone = randomPhone();
      const linked = await ctx
        .http()
        .post('/api/v1/auth/phone/link')
        .set(bearer(ama.token))
        .send({ phone, pin: '7391' })
        .expect(200);
      expect(linked.body.accessToken).toEqual(expect.any(String));

      const me = await ctx
        .http()
        .get('/api/v1/me')
        .set(bearer(linked.body.accessToken))
        .expect(200);
      expect(me.body).toEqual(
        expect.objectContaining({ id: ama.id, phone, email: ama.email }),
      );
      await signIn(phone, '7391').expect(200);

      const again = await ctx
        .http()
        .post('/api/v1/auth/phone/link')
        .set(bearer(ama.token))
        .send({ phone: randomPhone(), pin: '7391' })
        .expect(409);
      expect(again.body.error.code).toBe('PHONE_ALREADY_SET');
    });

    it('changes nothing while the Phone provider is off in Supabase', async () => {
      const awa = await ctx.createUser();
      ctx.authAdmin.setPhoneEnabled(false);
      try {
        const res = await ctx
          .http()
          .post('/api/v1/auth/phone/link')
          .set(bearer(awa.token))
          .send({ phone: randomPhone(), pin: '7391' })
          .expect(503);
        expect(res.body.error.code).toBe('PHONE_SIGN_IN_DISABLED');
        await signUp(randomPhone(), '7391').expect(503);
      } finally {
        ctx.authAdmin.setPhoneEnabled(true);
      }
      expect(ctx.authAdmin.passwords.has(awa.id)).toBe(false);
      const { rows } = await ctx.admin.query(
        'select phone from app.user_profiles where id = $1',
        [awa.id],
      );
      expect(rows).toEqual([{ phone: '' }]);
    });

    it('refuses the number of another account, and needs a session', async () => {
      const taken = randomPhone();
      await signUp(taken, '1357').expect(201);
      const kofi = await ctx.createUser();
      const res = await ctx
        .http()
        .post('/api/v1/auth/phone/link')
        .set(bearer(kofi.token))
        .send({ phone: taken, pin: '2468' })
        .expect(409);
      expect(res.body.error.code).toBe('PHONE_TAKEN');
      await ctx
        .http()
        .post('/api/v1/auth/phone/link')
        .send({ phone: randomPhone(), pin: '2468' })
        .expect(401);
    });
  });

  describe('a new code from the platform administrator', () => {
    let owner: TestUser;
    let stranger: TestUser;
    let shopId: string;
    let otherShopId: string;

    beforeAll(async () => {
      owner = await ctx.createUser({ phone: true });
      stranger = await ctx.createUser({ phone: true });
      shopId = (
        await ctx
          .http()
          .post('/api/v1/organizations')
          .set(bearer(owner.token))
          .send({ name: 'Boutique Ndiaye' })
          .expect(201)
      ).body.id;
      otherShopId = (
        await ctx
          .http()
          .post('/api/v1/organizations')
          .set(bearer(stranger.token))
          .send({ name: 'Boutique Fall' })
          .expect(201)
      ).body.id;
    });

    const setPin = (
      user: TestUser,
      shop: string,
      member: string,
      pin = '8642',
    ) =>
      ctx
        .http()
        .post(`/api/v1/admin/shops/${shop}/members/${member}/pin`)
        .set(bearer(user.token))
        .send({ pin });

    it('sets the code, lifts a lock, and writes it in the shop history', async () => {
      const zed = await ctx.platformAdmin();
      await ctx.admin.query(
        `insert into app.phone_sign_in_failures (phone, failures, locked_until)
         values ($1, 5, now() + interval '1 hour')`,
        [owner.phone],
      );
      await setPin(zed, shopId, owner.id).expect(204);
      await signIn(owner.phone!, '8642').expect(200);

      const { rows } = await ctx.admin.query(
        `select actor_type, actor_id, target_id from app.audit_logs
          where organization_id = $1 and action = 'platform.pin_reset'`,
        [shopId],
      );
      expect(rows).toEqual([
        { actor_type: 'platform_admin', actor_id: zed.id, target_id: owner.id },
      ]);
    });

    it('is for the platform administrator only', async () => {
      const res = await setPin(owner, shopId, owner.id).expect(403);
      expect(res.body.error.code).toBe('PLATFORM_ADMIN_REQUIRED');
    });

    it('only reaches a member of the shop named (isolation)', async () => {
      const zed = await ctx.platformAdmin();
      // The stranger belongs to another shop: not reachable through this one.
      const res = await setPin(zed, shopId, stranger.id).expect(404);
      expect(res.body.error.code).toBe('MEMBER_NOT_FOUND');
      await setPin(zed, otherShopId, owner.id).expect(404);
      await setPin(zed, 'not-a-uuid', owner.id).expect(404);
      const { rows } = await ctx.admin.query(
        `select count(*)::int as n from app.audit_logs
          where organization_id = $1 and action = 'platform.pin_reset'`,
        [otherShopId],
      );
      expect(rows[0].n).toBe(0);
    });

    it('refuses an account still on its e-mail, and a guessable code', async () => {
      const zed = await ctx.platformAdmin();
      const legacy = await ctx.createUser();
      await ctx.admin.query(
        `insert into app.organization_memberships (organization_id, user_id, role)
         values ($1, $2, 'member')`,
        [shopId, legacy.id],
      );
      expect(
        (await setPin(zed, shopId, legacy.id).expect(409)).body.error.code,
      ).toBe('NO_PHONE');
      await setPin(zed, shopId, owner.id, '1111').expect(400);
    });

    it('shows the team of the shop, and how each one signs in', async () => {
      const zed = await ctx.platformAdmin();
      const res = await ctx
        .http()
        .get(`/api/v1/admin/shops/${shopId}`)
        .set(bearer(zed.token))
        .expect(200);
      expect(res.body.team).toEqual(
        expect.arrayContaining([
          {
            userId: owner.id,
            contact: `+${owner.phone}`,
            hasPhone: true,
            role: 'owner',
            active: true,
          },
          expect.objectContaining({ hasPhone: false, role: 'member' }),
        ]),
      );
      expect(res.body.ownerEmails).toEqual([`+${owner.phone}`]);
    });
  });
});
