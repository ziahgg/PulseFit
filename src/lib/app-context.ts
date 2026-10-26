import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import { findProfile, todayFor } from '@/lib/services/data';
import { requireUser } from '@/lib/supabase/server';

/** Signed-in user, profile and their local "today". Redirects to onboarding until it is done. */
export const appContext = cache(async (opts: { allowOnboarding?: boolean } = {}) => {
  const { supabase, userId, email } = await requireUser();
  const profile = await findProfile(supabase, userId);
  // A valid token without a profile means the account was removed: clear the session.
  if (!profile) redirect('/auth/signout');
  if (!profile.onboarded_at && !opts.allowOnboarding) redirect('/onboarding');
  return { db: supabase, userId, email, profile, today: todayFor(profile) };
});
