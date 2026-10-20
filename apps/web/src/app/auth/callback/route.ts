import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from '@/lib/auth/redirect';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Landing point of e-mail confirmation and password-reset links (PKCE):
 * exchanges the one-time code for a session cookie, then redirects in-app.
 *
 * Failures are logged with their reason code only (never the code itself),
 * so a broken link can be diagnosed from the runtime logs.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    console.error('auth.callback failed: supabase_not_configured');
    return NextResponse.redirect(new URL('/lien-invalide', origin));
  }

  if (!code) {
    // Supabase reports link errors (expired, already used…) as query params.
    console.warn(
      `auth.callback failed: ${searchParams.get('error_code') ?? 'missing_code'}`,
    );
    return NextResponse.redirect(new URL('/lien-invalide', origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Typically the PKCE verifier cookie is missing because the link was
    // opened in another browser than the one used to sign up.
    console.warn(`auth.callback failed: ${error.code ?? error.name}`);
    return NextResponse.redirect(new URL('/lien-invalide', origin));
  }
  return NextResponse.redirect(new URL(next, origin));
}
