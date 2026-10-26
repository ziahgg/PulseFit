import type { Metadata } from 'next';

import { SignInForm } from '@/components/auth-forms';
import { AuthShell } from '@/components/auth-shell';

export const metadata: Metadata = { title: 'Sign in' };

const NOTICES: Record<string, string> = {
  confirmed: 'Email confirmed. Sign in to continue.',
  'link-expired': 'That link has expired or was already used. Sign in or request a new one.',
  'signed-out': 'You’ve been signed out. Sign in to continue.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const { next, notice } = await searchParams;
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue to PulseFit.">
      <SignInForm next={next} notice={notice ? NOTICES[notice] : undefined} />
    </AuthShell>
  );
}
