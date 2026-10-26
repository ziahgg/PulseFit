import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { UpdatePasswordForm } from '@/components/auth-forms';
import { AuthShell } from '@/components/auth-shell';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Choose a new password' };

/** Reached from the password-reset email (the link signs the user in first via /auth/confirm). */
export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect('/login?notice=link-expired');
  return (
    <AuthShell title="Choose a new password" subtitle="You’ll stay signed in on this device." back="/home">
      <UpdatePasswordForm />
    </AuthShell>
  );
}
