import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, '../../../../supabase/migrations');
const API_ROLE_PASSWORD = 'nagaw_api_test_only';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    adminDatabaseUrl: string;
    platformAdmin: { id: string; email: string };
  }
}

/**
 * Builds a throwaway database from the real SQL migrations (plus a minimal
 * Supabase stub) and hands the tests a connection string for the
 * least-privileged `nagaw_api` role, exactly as the API uses in production.
 */
export default async function setup(project: TestProject) {
  const adminUrl = new URL(
    process.env.TEST_DATABASE_ADMIN_URL ??
      'postgres://postgres@127.0.0.1:54329/postgres',
  );
  const dbName = `nagaw_test_${process.pid}`;

  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName}`);
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const testAdminUrl = new URL(adminUrl);
  testAdminUrl.pathname = `/${dbName}`;
  const client = new pg.Client({ connectionString: testAdminUrl.toString() });
  await client.connect();
  await client.query(await readFile(join(here, 'supabase-stub.sql'), 'utf8'));
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of files) {
    await client.query(await readFile(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  await client.query(
    `alter role nagaw_api with login password '${API_ROLE_PASSWORD}'`,
  );
  // The platform has a single administrator (ADR-039), shared by the test
  // files; member of no shop.
  const platformAdmin = {
    id: randomUUID(),
    email: 'platform-admin@example.test',
  };
  await client.query('insert into auth.users (id, email) values ($1, $2)', [
    platformAdmin.id,
    platformAdmin.email,
  ]);
  await client.query(
    `insert into app.platform_admins (user_id, note) values ($1, 'test')`,
    [platformAdmin.id],
  );
  await client.end();

  const apiUrl = new URL(testAdminUrl);
  apiUrl.username = 'nagaw_api';
  apiUrl.password = API_ROLE_PASSWORD;
  project.provide('databaseUrl', apiUrl.toString());
  project.provide('adminDatabaseUrl', testAdminUrl.toString());
  project.provide('platformAdmin', platformAdmin);

  return async () => {
    const cleanup = new pg.Client({ connectionString: adminUrl.toString() });
    await cleanup.connect();
    await cleanup.query(`drop database if exists ${dbName} with (force)`);
    await cleanup.end();
  };
}
