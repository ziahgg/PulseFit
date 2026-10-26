'use client';

import { ArrowLeft, Check } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { completeOnboarding } from '@/app/actions/profile';
import { FOCUS_AREAS } from '@/lib/validations';
import { signOut } from '@/app/actions/auth';
import { useToast } from './toast';
import { Button, cx } from './ui';

type Focus = (typeof FOCUS_AREAS)[number];
const OPTIONS: { id: Focus; label: string; image: string; alt: string }[] = [
  { id: 'flexibility', label: 'Flexibility', image: 'yoga', alt: 'Person in downward dog' },
  { id: 'strength', label: 'Strength', image: 'strength', alt: 'Person lifting weights' },
  { id: 'mobility', label: 'Mobility', image: 'mobility', alt: 'Person in a seated twist' },
  { id: 'cardio', label: 'Cardio', image: 'cardio', alt: 'Group cardio class' },
  { id: 'core', label: 'Core', image: 'core', alt: 'Person doing crunches' },
  { id: 'stress_relief', label: 'Stress relief', image: 'breathing', alt: 'Person meditating' },
];

/** Figma 00b Choose your focus: pick up to 3. Also stores the browser timezone for local calendar days. */
export function OnboardingForm({ initial }: { initial: string[] }) {
  const [picked, setPicked] = useState<Focus[]>(initial.filter((f): f is Focus => (FOCUS_AREAS as readonly string[]).includes(f)));
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const toggle = (id: Focus) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));
  const submit = (focus: Focus[]) =>
    start(async () => {
      const r = await completeOnboarding({ focus, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
      if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t save', message: r.error });
      router.replace('/home');
      router.refresh();
    });

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-5 pt-[max(20px,env(safe-area-inset-top))] pb-32">
      <header className="flex h-14 items-center justify-between">
        <form action={signOut}>
          <button type="submit" aria-label="Back to sign in" className="grid size-14 place-items-center rounded-full border border-border bg-surface">
            <ArrowLeft size={22} aria-hidden />
          </button>
        </form>
        <span className="t-body text-text-muted">Step 1 of 1</span>
        <button type="button" onClick={() => submit([])} disabled={pending} className="t-body-m">
          Skip
        </button>
      </header>
      <div className="mt-5 h-2 rounded-full bg-surface-muted" aria-hidden>
        <div className="h-full w-full rounded-full bg-brand" />
      </div>
      <h1 className="mt-6 t-title-xl">What do you want to focus on?</h1>
      <p className="mt-3 t-body text-text-secondary">Pick up to 3. We’ll use this to suggest workouts.</p>
      <div className="mt-5 grid grid-cols-2 gap-3" role="group" aria-label="Focus areas">
        {OPTIONS.map((o) => {
          const on = picked.includes(o.id);
          const full = !on && picked.length >= 3;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              disabled={full}
              onClick={() => toggle(o.id)}
              className={cx('relative h-[170px] overflow-hidden rounded-[24px] text-left disabled:opacity-60', on ? 'ring-[3px] ring-brand' : '')}
            >
              <Image src={`/images/${o.image}.jpg`} alt={o.alt} fill sizes="(min-width: 560px) 260px, 50vw" className="photo object-cover" />
              <span className={cx('absolute bottom-3 left-3 inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 t-body-m', on ? 'bg-brand text-white' : 'bg-white text-text')}>
                {on ? <Check size={16} aria-hidden /> : null}
                {o.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-bg from-70% to-transparent px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[520px]">
          <Button full loading={pending} onClick={() => submit(picked)} disabled={!picked.length}>
            {picked.length ? `Continue · ${picked.length} selected` : 'Pick at least one'}
          </Button>
        </div>
      </div>
    </main>
  );
}
