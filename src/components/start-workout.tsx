'use client';

import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { startWorkout } from '@/app/actions/session';
import { ConfirmDialog } from './overlays';
import { useToast } from './toast';
import { Button } from './ui';

/**
 * Starts a session. If another one is still running, asks first and resumes it —
 * the database allows only one active session per user.
 */
export function StartWorkoutButton({ templateId, activeId, activeName, disabled }: { templateId: string; activeId: string | null; activeName: string | null; disabled?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState(false);

  const go = () =>
    start(async () => {
      const r = await startWorkout(templateId);
      if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t start the workout', message: r.error });
      router.push(`/session/${r.data.workoutId}`);
    });

  return (
    <>
      <Button full icon={Play} loading={pending} disabled={disabled} onClick={() => (activeId ? setAsk(true) : go())}>
        Start workout
      </Button>
      <ConfirmDialog
        open={ask}
        title="Workout in progress"
        message={`You’re still in ${activeName ?? 'another workout'}. Finish or end it before starting a new one.`}
        cancelLabel="Resume it"
        confirmLabel="Not now"
        onCancel={() => {
          setAsk(false);
          if (activeId) router.push(`/session/${activeId}`);
        }}
        onConfirm={() => setAsk(false)}
        onDismiss={() => setAsk(false)}
      />
    </>
  );
}
