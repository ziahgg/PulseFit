import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from '@/types/database';
import { supabaseEnv } from './env';

const PUBLIC_PATHS = ['/welcome', '/login', '/signup', '/forgot-password', '/auth', '/setup'];
// /auth/signout must stay reachable while signed in, so it is public but not an auth page.
const AUTH_PAGES = ['/welcome', '/login', '/signup', '/forgot-password'];

const isPublic = (path: string) => PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Refreshes the Supabase session cookie on every request and handles redirects between
 * public and protected pages. Pages still verify the user themselves (requireUser) and RLS
 * is the real security boundary; this only keeps navigation tidy.
 */
export async function updateSession(request: NextRequest) {
  const env = supabaseEnv();
  const path = request.nextUrl.pathname;
  if (!env) {
    // Not configured yet: show the setup screen instead of failing on every page.
    return path === '/setup' ? NextResponse.next() : NextResponse.redirect(new URL('/setup', request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  // Do not run code between createServerClient and getClaims: it refreshes expired sessions.
  const { data } = await supabase.auth.getClaims();
  const signedIn = typeof data?.claims?.sub === 'string';

  const redirectTo = (to: string) => {
    const res = NextResponse.redirect(new URL(to, request.url));
    for (const c of response.cookies.getAll()) res.cookies.set(c);
    return res;
  };

  if (!signedIn && !isPublic(path)) {
    const next = path === '/' ? '' : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return redirectTo(path === '/' ? '/welcome' : `/login${next}`);
  }
  if (signedIn && (path === '/' || AUTH_PAGES.includes(path))) return redirectTo('/home');
  return response;
}
