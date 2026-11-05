import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { inject } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { AUTH_PROBE } from '../../src/auth/auth-probe.js';
import { JWT_VERIFIER } from '../../src/auth/jwt-verifier.js';
import { ENV, loadEnv } from '../../src/config/env.js';
import { AUTH_ADMIN } from '../../src/phone-auth/auth-admin.js';
import { WAVE_CLIENT, type WaveClient } from '../../src/orders/wave.client.js';
import { createFakeAuthAdmin } from './auth-admin.js';
import { createTestAuth } from './jwt.js';

export interface TestUser {
  id: string;
  email: string;
  /** International digits, for an account with a number (ADR-058). */
  phone: string | null;
  token: string;
}

/** A Senegalese number nobody else in the test database has. */
export function randomPhone(): string {
  return `2217${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

/**
 * Boots the real application against the test database. `wave` stands in
 * for the Wave Business API (ADR-065): no test reaches the real one.
 */
export async function createTestContext(options: { wave?: WaveClient } = {}) {
  const auth = await createTestAuth();
  const admin = new pg.Pool({ connectionString: inject('adminDatabaseUrl') });
  const authAdmin = createFakeAuthAdmin(admin, auth.sign);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue(
      loadEnv({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: inject('databaseUrl'),
        DATABASE_SSL: 'disable',
        // Postgres in Docker on a busy machine opens connections slowly.
        DATABASE_CONNECT_TIMEOUT_MS: '20000',
        SUPABASE_SECRET_KEY: 'sb_secret_test_only_0123456789',
        PHONE_PIN_PEPPER: 'test-only-pepper-0123456789abcdef',
        // 32 bytes, for the sealed secrets of the tests only (ADR-009).
        CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
        WEB_URL: 'https://nagaw.test',
      }),
    )
    .overrideProvider(WAVE_CLIENT)
    .useValue(
      options.wave ?? {
        createSession: () => Promise.reject(new Error('Wave not faked')),
        getSession: () => Promise.reject(new Error('Wave not faked')),
        probe: () => Promise.reject(new Error('Wave not faked')),
      },
    )
    // Supabase Auth itself is faked (support/auth-admin.ts).
    .overrideProvider(AUTH_ADMIN)
    .useValue(authAdmin.fake)
    .overrideProvider(JWT_VERIFIER)
    .useValue(auth.verifier)
    // The test key pair stands in for the project JWKS.
    .overrideProvider(AUTH_PROBE)
    .useValue({ check: () => Promise.resolve('ok') })
    .compile();
  const app: INestApplication = moduleRef.createNestApplication({
    rawBody: true,
  });
  setupApp(app);
  await app.init();

  /**
   * Creates a Supabase-like user; the auth trigger creates its profile.
   * With `phone`, the account also has a number, as phone accounts do.
   */
  async function createUser(
    options: { phone?: boolean } = {},
  ): Promise<TestUser> {
    const id = randomUUID();
    const email = `user-${id.slice(0, 8)}@example.test`;
    const phone = options.phone ? randomPhone() : null;
    await admin.query(
      'insert into auth.users (id, email, phone) values ($1, $2, $3)',
      [id, email, phone],
    );
    return {
      id,
      email,
      phone,
      token: await auth.sign(id, { email, phone: phone ?? '' }),
    };
  }

  /** The single platform administrator (ADR-039), created by the setup. */
  async function platformAdmin(): Promise<TestUser> {
    const { id, email } = inject('platformAdmin');
    return { id, email, phone: null, token: await auth.sign(id, { email }) };
  }

  /**
   * Puts a shop on an offer, as the platform does (ADR-029): new shops
   * start on the free offer, too small for tests about teams and devices.
   */
  async function setPlan(organizationId: string, planKey: string) {
    await admin.query(
      'update app.subscriptions set plan_key = $2 where organization_id = $1',
      [organizationId, planKey],
    );
  }

  function http() {
    return request(app.getHttpServer());
  }

  async function close() {
    await app.close();
    await admin.end();
  }

  return {
    app,
    admin,
    auth,
    authAdmin,
    createUser,
    platformAdmin,
    setPlan,
    http,
    close,
  };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;
