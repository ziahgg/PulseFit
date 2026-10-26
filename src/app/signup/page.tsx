import type { Metadata } from 'next';

import { SignUpForm } from '@/components/auth-forms';
import { AuthShell } from '@/components/auth-shell';

export const metadata: Metadata = { title: 'Create account' };

export default function SignUpPage() {
  return (
    <AuthShell title="Create your account" subtitle="Track workouts, goals and progress in one place.">
      <SignUpForm />
    </AuthShell>
  );
}
