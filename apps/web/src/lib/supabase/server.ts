import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabaseConfig } from '../env';

/**
 * Supabase client bound to the request cookies. Returns null when Supabase
 * is not configured so callers can show an explicit message.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  const config = supabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch (error) {
          // Server Components cannot write cookies; the proxy refreshes the
          // session on the next request. Anything else is a real failure.
          if (!(
            error instanceof Error &&
            /Server Action|Route Handler/.test(error.message)
          )) {
            throw error;
          }
        }
      },
    },
  });
}
