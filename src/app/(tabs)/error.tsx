'use client';

import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui';

export default function TabsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-[480px] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="t-title">Something went wrong</h1>
      <p className="t-body text-text-secondary">We couldn’t load this screen. Check your connection and try again.</p>
      <Button icon={RotateCcw} onClick={reset} className="mt-2">
        Try again
      </Button>
    </main>
  );
}
