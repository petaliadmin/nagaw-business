import { HttpStatus } from '@nestjs/common';
import type { PhoneSessionDto } from '@nagaw/shared';
import { ApiException } from '../common/api-exception.js';

export const AUTH_ADMIN = Symbol('AUTH_ADMIN');

/**
 * What the API asks of Supabase Auth for phone accounts (ADR-058). The
 * number is international digits, the password the one derived from the
 * secret code (`pinPassword`), never the code itself.
 */
export interface AuthAdmin {
  /** Creates a confirmed phone account; `phone_taken` if it exists. */
  createUser(phone: string, password: string): Promise<string | 'phone_taken'>;
  /** Sets the number and/or password of an account, without SMS. */
  updateUser(
    userId: string,
    change: { phone?: string; password: string },
  ): Promise<'ok' | 'phone_taken'>;
  /** Opens a session; null when the number or the password is wrong. */
  signIn(phone: string, password: string): Promise<PhoneSessionDto | null>;
  /**
   * Whether the Phone provider is on in Supabase. Off, an account given a
   * number could not sign in with it: nothing is changed (ADR-058).
   */
  phoneEnabled(): Promise<boolean>;
}

const unavailable = (detail: string) => {
  // The reason goes to the logs through the global filter, not to the user.
  const error = new ApiException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'AUTH_UNAVAILABLE',
    'La connexion est momentanément indisponible. Réessayez dans un instant.',
  );
  error.cause = new Error(detail);
  return error;
};

const PHONE_TAKEN_CODES = new Set(['phone_exists', 'user_already_exists']);

/** Supabase Auth (GoTrue) admin and token endpoints, with the secret key. */
export class GoTrueAuthAdmin implements AuthAdmin {
  constructor(
    private readonly supabaseUrl: string,
    private readonly secretKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      apikey: this.secretKey,
      'Content-Type': 'application/json',
    };
    // The legacy service_role key is a JWT and goes in Authorization too;
    // a `sb_secret_` key is only accepted as `apikey`.
    if (this.secretKey.startsWith('ey')) {
      headers.Authorization = `Bearer ${this.secretKey}`;
    }
    return headers;
  }

  private async call(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: unknown,
  ): Promise<{ status: number; json: Record<string, unknown> }> {
    let response: Response;
    try {
      response = await this.fetchImpl(
        new URL(`/auth/v1${path}`, this.supabaseUrl),
        {
          method,
          headers: this.headers(),
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(8000),
        },
      );
    } catch (error) {
      throw unavailable(
        `Supabase Auth unreachable (${path}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const text = await response.text();
    let json: Record<string, unknown> = {};
    if (text) {
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw unavailable(
          `Supabase Auth answered ${response.status} with non-JSON (${path})`,
        );
      }
    }
    return { status: response.status, json };
  }

  private static code(json: Record<string, unknown>): string {
    const code = json.error_code ?? json.code ?? json.error;
    return typeof code === 'string' ? code : '';
  }

  async phoneEnabled() {
    const { status, json } = await this.call('GET', '/settings');
    if (status !== 200) {
      throw unavailable(`Supabase Auth settings answered ${status}`);
    }
    const external = json.external as Record<string, unknown> | undefined;
    return external?.phone === true;
  }

  async createUser(phone: string, password: string) {
    const { status, json } = await this.call('POST', '/admin/users', {
      phone,
      password,
      phone_confirm: true,
    });
    if (status === 200 || status === 201) {
      if (typeof json.id !== 'string') {
        throw unavailable('Supabase Auth created a user without an id');
      }
      return json.id;
    }
    if (PHONE_TAKEN_CODES.has(GoTrueAuthAdmin.code(json))) return 'phone_taken';
    throw unavailable(
      `Supabase Auth refused the account: ${status} ${GoTrueAuthAdmin.code(json)}`,
    );
  }

  async updateUser(
    userId: string,
    change: { phone?: string; password: string },
  ) {
    const { status, json } = await this.call(
      'PUT',
      `/admin/users/${encodeURIComponent(userId)}`,
      change.phone
        ? {
            phone: change.phone,
            phone_confirm: true,
            password: change.password,
          }
        : { password: change.password },
    );
    if (status === 200) return 'ok' as const;
    if (PHONE_TAKEN_CODES.has(GoTrueAuthAdmin.code(json))) {
      return 'phone_taken' as const;
    }
    throw unavailable(
      `Supabase Auth refused the change: ${status} ${GoTrueAuthAdmin.code(json)}`,
    );
  }

  async signIn(phone: string, password: string) {
    const { status, json } = await this.call(
      'POST',
      '/token?grant_type=password',
      { phone, password },
    );
    if (status === 200) {
      const { access_token: accessToken, refresh_token: refreshToken } = json;
      if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
        throw unavailable('Supabase Auth opened a session without tokens');
      }
      return { accessToken, refreshToken };
    }
    if (
      status === 400 &&
      GoTrueAuthAdmin.code(json) === 'invalid_credentials'
    ) {
      return null;
    }
    throw unavailable(
      `Supabase Auth refused the sign-in: ${status} ${GoTrueAuthAdmin.code(json)}`,
    );
  }
}

/** Without the secret key, phone accounts cannot work: say so. */
export class UnconfiguredAuthAdmin implements AuthAdmin {
  private fail(): Promise<never> {
    return Promise.reject(
      new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'AUTH_NOT_CONFIGURED',
        'La connexion par téléphone n’est pas configurée.',
      ),
    );
  }
  createUser() {
    return this.fail();
  }
  updateUser() {
    return this.fail();
  }
  signIn() {
    return this.fail();
  }
  phoneEnabled() {
    return this.fail();
  }
}
