'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';

import { deleteMeasurement, saveMeasurement } from '@/app/actions/goals';
import { dayLabel } from '@/lib/domain/dates';
import { toCm, toKg } from '@/lib/domain/units';
import type { FieldErrors } from '@/lib/validations';
import type { BodyMetric, Units } from '@/types/database';
import { ConfirmDialog, Sheet } from './overlays';
import { useToast } from './toast';
import { Button, Field, FormError, IconButton, SectionHeader } from './ui';

type Row = { id: string; date: string; value: number; display: number; notes: string };
const LABEL: Record<BodyMetric, string> = { weight: 'Weight', body_fat: 'Body fat', waist: 'Waist', chest: 'Chest', hips: 'Hips' };

export function MeasurementsPanel({ type, units, today, rows }: { type: BodyMetric; units: Units; today: string; rows: Row[] }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<{ id: string | null; value: string; date: string; notes: string } | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const unit = type === 'weight' ? (units === 'metric' ? 'kg' : 'lb') : type === 'body_fat' ? '%' : units === 'metric' ? 'cm' : 'in';

  const save = () =>
    start(async () => {
      if (!editing) return;
      const n = Number(editing.value);
      if (!editing.value || Number.isNaN(n)) return setErrors({ value: 'Enter a number' });
      const canonical = type === 'weight' ? toKg(n, units) : type === 'body_fat' ? n : toCm(n, units);
      const r = await saveMeasurement({ id: editing.id, measurementType: type, value: canonical, measuredAt: editing.date, notes: editing.notes });
      if (!r.ok) {
        setErrors(r.fields ?? {});
        setFormError(r.fields ? undefined : r.error);
        return;
      }
      setEditing(null);
      toast({ title: editing.id ? 'Entry updated' : 'Entry added', message: `${LABEL[type]} · ${n} ${unit}` });
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!del) return;
      const r = await deleteMeasurement(del.id);
      if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t delete', message: r.error });
      setDel(null);
      toast({ title: 'Entry deleted' });
      router.refresh();
    });

  const open = (row: Row | null) => {
    setErrors({});
    setFormError(undefined);
    setEditing(row ? { id: row.id, value: String(row.display), date: row.date, notes: row.notes } : { id: null, value: '', date: today, notes: '' });
  };

  return (
    <>
      <Button icon={Plus} full onClick={() => open(null)}>
        Add {LABEL[type].toLowerCase()} entry
      </Button>
      <section aria-labelledby="hist-h" className="flex flex-col gap-3">
        <SectionHeader id="hist-h" title="History" />
        {rows.length ? (
          <ul className="divide-y divide-divider overflow-hidden rounded-[24px] bg-surface">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="t-item block num">
                    {r.display} {unit}
                  </span>
                  <span className="t-body block truncate text-text-muted">
                    {dayLabel(r.date)}
                    {r.notes ? ` · ${r.notes}` : ''}
                  </span>
                </span>
                <IconButton icon={Pencil} label={`Edit entry from ${dayLabel(r.date)}`} look="muted" size="md" onClick={() => open(r)} />
                <IconButton icon={Trash2} label={`Delete entry from ${dayLabel(r.date)}`} look="muted" size="md" onClick={() => setDel(r)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[24px] bg-surface p-5 t-body text-text-secondary">No {LABEL[type].toLowerCase()} entries yet.</p>
        )}
      </section>
      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit ${LABEL[type].toLowerCase()}` : `Add ${LABEL[type].toLowerCase()}`}
        footer={
          <Button full loading={pending} onClick={save}>
            Save
          </Button>
        }
      >
        {editing ? (
          <div className="flex flex-col gap-4">
            <FormError message={formError} />
            <Field id={`${id}-v`} label={`${LABEL[type]} (${unit})`} inputMode="decimal" autoFocus value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value.replace(/[^\d.]/g, '').slice(0, 6) })} error={errors.value} />
            <Field id={`${id}-d`} label="Date" type="date" max={today} value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} error={errors.measuredAt} />
            <Field id={`${id}-n`} label="Note (optional)" maxLength={200} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} error={errors.notes} />
          </div>
        ) : null}
      </Sheet>
      <ConfirmDialog open={!!del} title="Delete this entry?" message={del ? `${del.display} ${unit} on ${dayLabel(del.date)} will be removed.` : ''} cancelLabel="Keep it" confirmLabel="Delete" danger loading={pending} onCancel={() => setDel(null)} onConfirm={remove} />
    </>
  );
}
