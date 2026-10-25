import { z } from 'zod';

const optionalUrl = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .pipe(z.url().optional())
  .optional();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_ENV: z.enum(['local', 'preview', 'production']).default('local'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  APP_VERSION: z.string().default('dev'),
  /** Supabase project URL; the JWKS and token issuer are derived from it. */
  SUPABASE_URL: optionalUrl,
  /** Postgres connection string for the `nagaw_api` role (secret). */
  DATABASE_URL: optionalUrl,
  /**
   * disable: local only. require: encrypted, certificate not verified (libpq
   * semantics). verify-full: encrypted and verified against DATABASE_CA_CERT.
   */
  DATABASE_SSL: z
    .enum(['disable', 'require', 'verify-full'])
    .default('require'),
  DATABASE_CA_CERT: z.string().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(3),
  /** Time allowed to open a connection before answering 503 (ms). */
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(60_000)
    .default(5000),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses and validates process environment. Throws with the list of invalid
 * variables (names only, never values) so a misconfigured deployment fails
 * fast at boot instead of at the first request.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration — ${fields}`);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
