import type { ReactNode } from 'react';

import { TopBar } from './ui';

/** Shared frame for sign-in, sign-up and password screens. */
export function AuthShell({ title, subtitle, back = '/welcome', children }: { title: string; subtitle: string; back?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pt-[max(16px,env(safe-area-inset-top))] pb-10">
      <TopBar title="" back={back} />
      <h1 className="mt-6 t-title-xl">{title}</h1>
      <p className="mt-2 mb-6 t-body text-text-secondary">{subtitle}</p>
      {children}
    </main>
  );
}
