import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { AuthAdmin } from '../../src/phone-auth/auth-admin.js';

/**
 * Supabase Auth for the tests: accounts go to the stub `auth.users`, so the
 * real trigger fills their profile, and sessions are real signed tokens.
 * Passwords are kept as received: tests can check the code never is one.
 */
export function createFakeAuthAdmin(
  admin: pg.Pool,
  sign: (userId: string, claims: Record<string, unknown>) => Promise<string>,
) {
  const passwords = new Map<string, string>();
  let outage = false;
  let phoneOn = true;

  async function session(userId: string, phone: string) {
    const accessToken = await sign(userId, { phone, email: '' });
    return { accessToken, refreshToken: `refresh-${randomUUID()}` };
  }

  async function userOfPhone(phone: string) {
    const { rows } = await admin.query<{ id: string }>(
      'select id from auth.users where phone = $1',
      [phone],
    );
    return rows[0]?.id;
  }

  function down() {
    if (outage) throw new Error('Supabase Auth unreachable (fake outage)');
  }

  const fake: AuthAdmin = {
    async createUser(phone, password) {
      down();
      if (await userOfPhone(phone)) return 'phone_taken';
      const id = randomUUID();
      await admin.query('insert into auth.users (id, phone) values ($1, $2)', [
        id,
        phone,
      ]);
      passwords.set(id, password);
      return id;
    },
    async updateUser(userId, change) {
      down();
      if (change.phone) {
        const owner = await userOfPhone(change.phone);
        if (owner && owner !== userId) return 'phone_taken';
        await admin.query('update auth.users set phone = $2 where id = $1', [
          userId,
          change.phone,
        ]);
      }
      passwords.set(userId, change.password);
      return 'ok';
    },
    async phoneEnabled() {
      down();
      return phoneOn;
    },
    async signIn(phone, password) {
      down();
      const id = await userOfPhone(phone);
      if (!id || passwords.get(id) !== password) return null;
      return session(id, phone);
    },
  };

  return {
    fake,
    passwords,
    /** Makes every call fail, as when Supabase cannot be reached. */
    setOutage(value: boolean) {
      outage = value;
    },
    /** Turns the Phone provider of the fake Supabase on or off. */
    setPhoneEnabled(value: boolean) {
      phoneOn = value;
    },
  };
}
