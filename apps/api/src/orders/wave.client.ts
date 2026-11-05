import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ApiException } from '../common/api-exception.js';
import { ENV, type Env } from '../config/env.js';
import { waveSignature } from './wave-signature.js';

/** The part of a Wave checkout session the application reads. */
export interface WaveSession {
  id: string;
  amount: string;
  currency: string;
  checkoutStatus: 'open' | 'complete' | 'expired';
  /** Null before any attempt: the docs list no value for it. */
  paymentStatus: 'processing' | 'cancelled' | 'succeeded' | null;
  clientReference: string | null;
  transactionId: string | null;
  launchUrl: string;
  expiresAt: string;
}

export interface WaveCredentials {
  apiKey: string;
  signingSecret: string | null;
}

export interface WaveClient {
  createSession(
    credentials: WaveCredentials,
    input: {
      amount: string;
      currency: string;
      successUrl: string;
      errorUrl: string;
      clientReference: string;
    },
  ): Promise<WaveSession>;
  getSession(credentials: WaveCredentials, id: string): Promise<WaveSession>;
  /** Whether the key opens the account: a search that finds nothing. */
  probe(credentials: WaveCredentials): Promise<void>;
}

export const WAVE_CLIENT = Symbol('WAVE_CLIENT');

/** What Wave answered, said to the person in a word they can act on. */
export const waveRefused = (status: number) =>
  new ApiException(
    HttpStatus.BAD_GATEWAY,
    status === 401 || status === 403 ? 'WAVE_KEY_REFUSED' : 'WAVE_UNAVAILABLE',
    status === 401 || status === 403
      ? 'Wave refuse la clé de la boutique. Vérifiez-la dans Mon catalogue en ligne.'
      : 'Wave ne répond pas pour l’instant. Réessayez dans un moment.',
  );

interface RawSession {
  id: string;
  amount: string;
  currency: string;
  checkout_status: WaveSession['checkoutStatus'];
  payment_status?: WaveSession['paymentStatus'];
  client_reference?: string | null;
  transaction_id?: string | null;
  wave_launch_url: string;
  when_expires: string;
}

export function fromRawSession(raw: RawSession): WaveSession {
  return {
    id: raw.id,
    amount: raw.amount,
    currency: raw.currency,
    checkoutStatus: raw.checkout_status,
    paymentStatus: raw.payment_status ?? null,
    clientReference: raw.client_reference ?? null,
    transactionId: raw.transaction_id ?? null,
    launchUrl: raw.wave_launch_url,
    expiresAt: raw.when_expires,
  };
}

/**
 * Wave Business API over HTTPS (https://docs.wave.com/checkout). The key
 * is sent as a bearer token; a key created with request signing also gets
 * a `Wave-Signature`. Neither ever reaches a log.
 */
@Injectable()
export class HttpWaveClient implements WaveClient {
  private readonly logger = new Logger(HttpWaveClient.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  private async call<T>(
    credentials: WaveCredentials,
    method: 'GET' | 'POST',
    path: string,
    body?: object,
  ): Promise<T> {
    const text = body === undefined ? '' : JSON.stringify(body);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${credentials.apiKey}`,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (credentials.signingSecret)
      headers['Wave-Signature'] = waveSignature(
        credentials.signingSecret,
        text,
        Math.floor(Date.now() / 1000),
      );
    let response: Response;
    try {
      const init: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(8000),
      };
      // A GET has no body; Wave signs it as the timestamp alone.
      if (body !== undefined) init.body = text;
      response = await fetch(new URL(path, this.env.WAVE_API_URL), init);
    } catch (error) {
      this.logger.warn(
        `Wave injoignable (${method} ${path}): ${String(error)}`,
      );
      throw waveRefused(0);
    }
    if (!response.ok) {
      // The code only: Wave's message may repeat what was sent.
      let code = '';
      try {
        code = String(
          ((await response.json()) as { code?: unknown }).code ?? '',
        );
      } catch {
        code = 'unreadable';
      }
      this.logger.warn(`Wave ${method} ${path}: ${response.status} ${code}`);
      throw waveRefused(response.status);
    }
    return (await response.json()) as T;
  }

  async createSession(
    credentials: WaveCredentials,
    input: Parameters<WaveClient['createSession']>[1],
  ): Promise<WaveSession> {
    return fromRawSession(
      await this.call<RawSession>(
        credentials,
        'POST',
        '/v1/checkout/sessions',
        {
          amount: input.amount,
          currency: input.currency,
          success_url: input.successUrl,
          error_url: input.errorUrl,
          client_reference: input.clientReference,
        },
      ),
    );
  }

  async getSession(
    credentials: WaveCredentials,
    id: string,
  ): Promise<WaveSession> {
    return fromRawSession(
      await this.call<RawSession>(
        credentials,
        'GET',
        `/v1/checkout/sessions/${encodeURIComponent(id)}`,
      ),
    );
  }

  async probe(credentials: WaveCredentials): Promise<void> {
    await this.call(
      credentials,
      'GET',
      '/v1/checkout/sessions/search?client_reference=nagaw-probe',
    );
  }
}
