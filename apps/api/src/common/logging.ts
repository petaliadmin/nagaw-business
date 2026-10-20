import { randomUUID } from 'node:crypto';
import type { Options } from 'pino-http';
import type { Env } from '../config/env.js';

interface SerializedRequest {
  id?: unknown;
  method?: string;
  url?: string;
}

interface SerializedResponse {
  statusCode?: number;
}

/**
 * Allowlist of what an HTTP log line may contain. Headers and query strings
 * are dropped entirely: platforms add their own credentials there (Vercel
 * OIDC tokens, proxy signatures, share tokens), so masking known names is
 * not enough.
 */
export function serializeRequest(req: SerializedRequest) {
  return {
    id: req.id,
    method: req.method,
    path: req.url?.split('?')[0],
  };
}

export function serializeResponse(res: SerializedResponse) {
  return { statusCode: res.statusCode };
}

export function buildHttpLoggerOptions(env: Env): Options {
  return {
    level: env.LOG_LEVEL,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && /^[\w-]{1,64}$/.test(incoming)
          ? incoming
          : randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    serializers: { req: serializeRequest, res: serializeResponse },
    transport:
      env.APP_ENV === 'local' && env.NODE_ENV !== 'test'
        ? { target: 'pino-pretty', options: { singleLine: true } }
        : undefined,
  };
}
