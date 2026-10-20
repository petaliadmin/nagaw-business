import 'server-only';

export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

/**
 * Supabase project URL and publishable key. Both are public by design
 * (NEXT_PUBLIC_*); no privileged key is ever read by the web app.
 */
export function supabaseConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function apiBaseUrl(): string | undefined {
  return process.env.API_URL || undefined;
}

/** Public URL of this site, used in links sent by e-mail. */
export function siteUrl(): string {
  return (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}
