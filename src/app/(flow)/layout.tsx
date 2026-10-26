import { requireUser } from '@/lib/supabase/server';

/** Full-screen flows (active workout, forms, onboarding): signed in, no tab bar. */
export default async function FlowLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireUser();
  return <div className="min-h-dvh">{children}</div>;
}
