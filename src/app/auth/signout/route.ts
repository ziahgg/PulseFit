import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * Clears the session cookies and returns to sign-in. Used when a still-valid token belongs to an
 * account that no longer has a profile (e.g. the user was deleted). Signing out is harmless, so GET is fine.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login?notice=signed-out', request.url));
}
