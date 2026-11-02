import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session cookies on each navigation. This is not an
 * authorization layer: pages and server actions check the session
 * themselves, and the API verifies every token.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  // Validates the JWT and refreshes it when needed.
  const { data, error } = await supabase.auth.getClaims();
  // A visitor without a session goes to the sign-in page before the
  // workspace renders, rather than from inside its layout, which would leave
  // the page unrendered. Any other failure (Supabase unreachable, invalid
  // token) is left to the layout, which keeps its own check.
  if (
    !data?.claims &&
    !error &&
    request.method === 'GET' &&
    /^\/espace(?:\/|$)/.test(request.nextUrl.pathname)
  ) {
    return NextResponse.redirect(new URL('/connexion', request.url));
  }
  return response;
}

// Public pages without a session (guides, robots.txt, sitemap, llms.txt,
// share images) skip the proxy: no Supabase round trip before they render.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|blog(?:/|$)|conditions$|confidentialite$|robots\\.txt|sitemap\\.xml|llms\\.txt|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
