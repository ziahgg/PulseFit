'use client';

import { useOptimistic, useTransition } from 'react';

import { setEffort } from '@/app/actions/session';
import type { Effort } from '@/types/database';
import { useToast } from './toast';
import { cx } from './ui';

export const EFFORT_LABEL: Record<Effort, string> = { easy: 'Easy', just_right: 'Just right', hard: 'Hard' };

export function EffortPicker({ workoutId, value }: { workoutId: string; value: Effort | null }) {
  const toast = useToast();
  const [effort, setOptimistic] = useOptimistic(value);
  const [, start] = useTransition();
  return (
    <div role="radiogroup" aria-label="How did it feel?" className="grid grid-cols-3 gap-2">
      {(Object.keys(EFFORT_LABEL) as Effort[]).map((e) => (
        <button
          key={e}
          type="button"
          role="radio"
          aria-checked={effort === e}
          onClick={() =>
            start(async () => {
              setOptimistic(e);
              const r = await setEffort(workoutId, e);
              if (!r.ok) toast({ kind: 'error', title: 'Couldn’t save effort', message: r.error });
            })
          }
          className={cx('h-11 rounded-full t-button-s', effort === e ? 'bg-ink text-on-ink' : 'bg-surface-muted text-text-secondary')}
        >
          {EFFORT_LABEL[e]}
        </button>
      ))}
    </div>
  );
}
