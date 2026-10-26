'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';

import { deleteSession, updateSession } from '@/app/actions/session';
import type { FieldErrors } from '@/lib/validations';
import type { Effort } from '@/types/database';
import { EFFORT_LABEL } from './effort-picker';
import { ConfirmDialog, Sheet } from './overlays';
import { useToast } from './toast';
import { Button, Field, FieldMessage, FormError, cx } from './ui';

/** Edit (notes, effort, duration) and delete for a saved session. */
export function SessionActions({ workoutId, name, notes, effort, minutes }: { workoutId: string; name: string; notes: string; effort: Effort | null; minutes: number }) {
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ notes, effort, minutes: String(minutes) });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const ids = { notes: useId(), minutes: useId() };

  const save = () =>
    start(async () => {
      const r = await updateSession({ workoutId, notes: form.notes, effort: form.effort, durationMinutes: Number(form.minutes) });
      if (!r.ok) {
        setErrors(r.fields ?? {});
        setFormError(r.fields ? undefined : r.error);
        return;
      }
      setSheet(false);
      toast({ title: 'Session updated', message: name });
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      const r = await deleteSession(workoutId);
      if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t delete', message: r.error });
      toast({ title: 'Session deleted', message: name });
      router.replace('/history');
    });

  return (
    <>
      <div className="flex gap-3">
        <Button
          variant="secondary"
          icon={Pencil}
          full
          onClick={() => {
            setForm({ notes, effort, minutes: String(minutes) });
            setErrors({});
            setFormError(undefined);
            setSheet(true);
          }}
        >
          Edit
        </Button>
        <Button variant="danger" icon={Trash2} full onClick={() => setConfirm(true)}>
          Delete
        </Button>
      </div>
      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Edit session"
        footer={
          <Button full loading={pending} onClick={save}>
            Save changes
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <FormError message={formError} />
          <Field id={ids.minutes} label="Duration (minutes)" inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value.replace(/\D/g, '').slice(0, 4) })} error={errors.durationMinutes} />
          <div className="flex flex-col gap-1.5">
            <span className="t-label text-text-secondary" id={`${ids.notes}-effort`}>
              Effort
            </span>
            <div role="radiogroup" aria-labelledby={`${ids.notes}-effort`} className="grid grid-cols-3 gap-2">
              {(Object.keys(EFFORT_LABEL) as Effort[]).map((e) => (
                <button key={e} type="button" role="radio" aria-checked={form.effort === e} onClick={() => setForm({ ...form, effort: form.effort === e ? null : e })} className={cx('h-11 rounded-full t-button-s', form.effort === e ? 'bg-ink text-on-ink' : 'bg-surface-muted')}>
                  {EFFORT_LABEL[e]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.notes} className="t-label text-text-secondary">
              Notes
            </label>
            <textarea id={ids.notes} rows={3} maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-[18px] border border-border bg-surface p-4 t-item outline-none focus:border-ink" aria-describedby={`${ids.notes}-msg`} />
            <FieldMessage id={`${ids.notes}-msg`} error={errors.notes} hint={`${form.notes.length}/500`} />
          </div>
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        title="Delete this session?"
        message={`${name} and its sets will be removed from your history and stats. This can’t be undone.`}
        cancelLabel="Keep it"
        confirmLabel="Delete session"
        danger
        loading={pending}
        onCancel={() => setConfirm(false)}
        onConfirm={remove}
      />
    </>
  );
}
