import {
  HttpStatus,
  Inject,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { ApiException } from '../common/api-exception.js';
import { ENV, type Env } from '../config/env.js';
import type { Database } from './schema.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly kysely: Kysely<Database> | undefined;

  constructor(@Inject(ENV) env: Env) {
    if (!env.DATABASE_URL) return;
    const pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      ssl: sslOptions(env),
      // Serverless instances are short-lived; do not hold idle connections.
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
    this.kysely = new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
    });
  }

  get isConfigured(): boolean {
    return this.kysely !== undefined;
  }

  /** Query builder; answers 503 when the database is not configured. */
  get db(): Kysely<Database> {
    if (!this.kysely) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'DATABASE_NOT_CONFIGURED',
        'La base de données n’est pas configurée.',
      );
    }
    return this.kysely;
  }

  async ping(): Promise<void> {
    await sql`select 1`.execute(this.db);
  }

  async onModuleDestroy(): Promise<void> {
    await this.kysely?.destroy();
  }
}

function sslOptions(env: Env): pg.PoolConfig['ssl'] {
  switch (env.DATABASE_SSL) {
    case 'disable':
      return false;
    case 'require':
      return { rejectUnauthorized: false };
    case 'verify-full':
      return { rejectUnauthorized: true, ca: env.DATABASE_CA_CERT };
  }
}
