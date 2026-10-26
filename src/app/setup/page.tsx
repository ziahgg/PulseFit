import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { supabaseEnv } from '@/lib/supabase/env';

export const metadata: Metadata = { title: 'Setup required' };

/** Shown instead of the app when Supabase environment variables are missing. */
export default function SetupPage() {
  if (supabaseEnv()) redirect('/');
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center gap-4 px-6 py-12">
      <h1 className="t-title-xl">PulseFit needs a Supabase project</h1>
      <p className="t-body text-text-secondary">
        Set <code className="rounded bg-surface-muted px-1">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="rounded bg-surface-muted px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in <code className="rounded bg-surface-muted px-1">.env.local</code> (see <code className="rounded bg-surface-muted px-1">.env.example</code>), apply the migrations in <code className="rounded bg-surface-muted px-1">supabase/migrations</code>, then restart the server.
      </p>
      <p className="t-body text-text-secondary">The README walks through local (Supabase CLI) and hosted setup.</p>
    </main>
  );
}
