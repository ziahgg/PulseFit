import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import type { Database } from '@/types/database';
import { requireSupabaseEnv } from './env';

/** Supabase client bound to the request's auth cookies. Every query runs as the signed-in user under RLS. */
export async function createClient() {
  const { url, key } = requireSupabaseEnv();
  const store = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only; the proxy refreshes the session instead.
        }
      },
    },
  });
}

export type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The verified user for this request (JWT signature checked by getClaims), or a redirect to sign-in.
 * Cached per request so layouts and pages share one check.
 */
export const requireUser = cache(async (): Promise<{ supabase: ServerClient; userId: string; email: string | null }> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || typeof sub !== 'string') redirect('/login');
  const email = typeof data?.claims?.email === 'string' ? data.claims.email : null;
  return { supabase, userId: sub, email };
});
