import 'server-only';
import { resolveSiteUrl } from './site-url';

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

/** Public URL of this site, used in e-mail and invitation links. */
export function siteUrl(): string {
  return resolveSiteUrl(process.env);
}

/**
 * Vercel "Protection Bypass for Automation" secret of the API project, set
 * only on previews, whose API deployments are behind Vercel Authentication.
 * Server-side only; never in NEXT_PUBLIC_*.
 */
export function apiProtectionBypass(): string | undefined {
  return process.env.API_PROTECTION_BYPASS || undefined;
}
