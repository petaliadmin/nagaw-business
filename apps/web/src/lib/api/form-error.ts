import type { FormState } from '@/lib/auth/schemas';
import type { ApiResult } from './call-api';

/** API error as form state, with field details mapped to their inputs. */
export function apiErrorState(
  result: Extract<ApiResult<unknown>, { ok: false }>,
): FormState {
  if (!result.details) return { status: 'error', message: result.message };
  const fieldErrors: Record<string, string> = {};
  for (const detail of result.details) {
    fieldErrors[detail.path] ??= detail.message;
  }
  return {
    status: 'error',
    message: `${result.message} ${result.details.map((d) => d.message).join(' ')}`,
    fieldErrors,
  };
}
