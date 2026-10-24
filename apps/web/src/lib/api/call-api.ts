import { apiErrorSchema } from '@nagaw/shared';

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      /** Field-level details (`path`, `message`), when the API sends them. */
      details?: { path: string; message: string }[];
    };

export interface CallApiOptions {
  baseUrl: string | undefined;
  token: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  /** Binary body (product photo), sent as is instead of JSON. */
  rawBody?: { data: Blob; contentType: string };
  organizationId?: string;
  /** Vercel deployment-protection bypass secret (previews only). */
  protectionBypass?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Calls the Nagaw API with the user's access token and normalizes every
 * outcome (success, documented error, network failure) into ApiResult.
 */
export async function callApi<T>(
  options: CallApiOptions,
): Promise<ApiResult<T>> {
  const {
    baseUrl,
    token,
    method = 'GET',
    path,
    body,
    rawBody,
    organizationId,
  } = options;
  if (!baseUrl) {
    return {
      ok: false,
      status: 0,
      code: 'API_NOT_CONFIGURED',
      message: 'API non configurée.',
    };
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (rawBody) headers['Content-Type'] = rawBody.contentType;
  else if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (organizationId) headers['X-Organization-Id'] = organizationId;
  if (options.protectionBypass) {
    headers['x-vercel-protection-bypass'] = options.protectionBypass;
  }

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(
      new URL(`/api/v1${path}`, baseUrl),
      {
        method,
        headers,
        body:
          rawBody?.data ??
          (body === undefined ? undefined : JSON.stringify(body)),
        cache: 'no-store',
        signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
      },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: 0,
      code: 'API_UNREACHABLE',
      message: `API injoignable (${reason}).`,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      status: response.status,
      code: 'API_INVALID_RESPONSE',
      message: 'Réponse inattendue de l’API.',
    };
  }

  if (response.ok)
    return { ok: true, status: response.status, data: payload as T };

  const parsed = apiErrorSchema.safeParse(payload);
  return parsed.success
    ? {
        ok: false,
        status: response.status,
        code: parsed.data.error.code,
        message: parsed.data.error.message,
        details: fieldDetails(parsed.data.error.details),
      }
    : {
        ok: false,
        status: response.status,
        code: `HTTP_${response.status}`,
        message: 'Erreur de l’API.',
      };
}

function fieldDetails(
  details: unknown[] | undefined,
): { path: string; message: string }[] | undefined {
  const fields = (details ?? []).filter(
    (detail): detail is { path: string; message: string } =>
      typeof detail === 'object' &&
      detail !== null &&
      typeof (detail as { path?: unknown }).path === 'string' &&
      typeof (detail as { message?: unknown }).message === 'string',
  );
  return fields.length > 0 ? fields : undefined;
}
