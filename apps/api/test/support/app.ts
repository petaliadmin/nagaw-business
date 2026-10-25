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
import { createTestAuth } from './jwt.js';

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

/** Boots the real application against the test database. */
export async function createTestContext() {
  const auth = await createTestAuth();
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
      }),
    )
    .overrideProvider(JWT_VERIFIER)
    .useValue(auth.verifier)
    // The test key pair stands in for the project JWKS.
    .overrideProvider(AUTH_PROBE)
    .useValue({ check: () => Promise.resolve('ok') })
    .compile();
  const app: INestApplication = moduleRef.createNestApplication();
  setupApp(app);
  await app.init();

  const admin = new pg.Pool({ connectionString: inject('adminDatabaseUrl') });

  /** Creates a Supabase-like user; the auth trigger creates its profile. */
  async function createUser(): Promise<TestUser> {
    const id = randomUUID();
    const email = `user-${id.slice(0, 8)}@example.test`;
    await admin.query('insert into auth.users (id, email) values ($1, $2)', [
      id,
      email,
    ]);
    return { id, email, token: await auth.sign(id, { email }) };
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

  return { app, admin, auth, createUser, setPlan, http, close };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;
