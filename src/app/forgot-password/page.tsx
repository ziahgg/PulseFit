import type { Metadata } from 'next';

import { ForgotForm } from '@/components/auth-forms';
import { AuthShell } from '@/components/auth-shell';

export const metadata: Metadata = { title: 'Reset password' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we’ll send you a link to choose a new password." back="/login">
      <ForgotForm />
    </AuthShell>
  );
}
