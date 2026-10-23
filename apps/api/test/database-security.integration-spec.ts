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

  it('applies the same rules to every table of the app schema', async () => {
    const { rows } = await admin.query<{ name: string; rls: boolean }>(
      `select c.relname as name, c.relrowsecurity as rls
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'app' and c.relkind = 'r' order by 1`,
    );
    expect(rows.map((row) => row.name)).toContain('organization_invitations');
    for (const { name, rls } of rows) {
      expect(rls, `${name} has RLS enabled`).toBe(true);
      await expect(api.query(`delete from app.${name}`)).rejects.toThrow(
        /permission denied/,
      );
      const { rows: grants } = await admin.query(
        `select grantee from information_schema.role_table_grants
         where table_schema = 'app' and table_name = $1
           and grantee in ('anon', 'authenticated', 'PUBLIC')`,
        [name],
      );
      expect(grants, `${name} grants to anon/authenticated`).toEqual([]);
    }
  });
});
