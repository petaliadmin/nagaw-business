import pg from 'pg';
import { inject } from 'vitest';

/**
 * Database-level defenses, independent of the API code: even with a leaked
 * Supabase anon key or a bug in the API, these must hold.
 */
describe('database privileges', () => {
  let admin: pg.Pool;
  let api: pg.Pool;

  beforeAll(() => {
    admin = new pg.Pool({ connectionString: inject('adminDatabaseUrl') });
    api = new pg.Pool({ connectionString: inject('databaseUrl') });
  });

  afterAll(async () => {
    await Promise.all([admin.end(), api.end()]);
  });

  it.each(['anon', 'authenticated'])(
    'denies the %s role any access to business tables',
    async (role) => {
      const client = await admin.connect();
      try {
        await client.query(`set role ${role}`);
        await expect(
          client.query('select * from app.organizations'),
        ).rejects.toThrow(/permission denied/);
      } finally {
        await client.query('reset role');
        client.release();
      }
    },
  );

  it('keeps the audit log append-only, even for the API role', async () => {
    await api.query(
      `insert into app.audit_logs (actor_type, action) values ('system', 'test.appended')`,
    );
    await expect(
      api.query(`update app.audit_logs set action = 'test.tampered'`),
    ).rejects.toThrow(/permission denied/);
    await expect(api.query('delete from app.audit_logs')).rejects.toThrow(
      /permission denied/,
    );
    // Even the owner role cannot rewrite history.
    await expect(
      admin.query(`update app.audit_logs set action = 'test.tampered'`),
    ).rejects.toThrow(/append-only/);
  });

  it('forbids the API role from deleting organizations', async () => {
    await expect(api.query('delete from app.organizations')).rejects.toThrow(
      /permission denied/,
    );
  });
});
