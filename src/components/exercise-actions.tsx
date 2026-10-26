'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { deleteExercise } from '@/app/actions/library';
import { ConfirmDialog } from './overlays';
import { useToast } from './toast';
import { Button } from './ui';

export function DeleteExerciseButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="danger" icon={Trash2} onClick={() => setOpen(true)}>
        Delete exercise
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete this exercise?"
        message="Past sessions keep their record of it. It must not be part of one of your workouts."
        cancelLabel="Keep it"
        confirmLabel="Delete"
        danger
        loading={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const r = await deleteExercise(id);
            if (!r.ok) {
              setOpen(false);
              return toast({ kind: 'error', title: 'Couldn’t delete', message: r.error });
            }
            toast({ title: 'Exercise deleted', message: name });
            router.replace('/exercises');
          })
        }
      />
    </>
  );
}
