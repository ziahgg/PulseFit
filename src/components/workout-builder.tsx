'use client';

import { ArrowDown, ArrowUp, Plus, Search, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState, useTransition } from 'react';

import { deleteTemplate, saveTemplate } from '@/app/actions/library';
import { displayWeight, toKg, weightLabel } from '@/lib/domain/units';
import { CATEGORY_LABEL } from '@/lib/domain/workouts';
import type { TemplateItem } from '@/lib/services/data';
import { CATEGORIES, DIFFICULTIES, EQUIPMENT, type FieldErrors } from '@/lib/validations';
import type { Category, Difficulty, Equipment, ExerciseRow, TemplateRow, Units } from '@/types/database';
import { DIFFICULTY_LABEL, EQUIPMENT_LABEL } from './cards';
import { ConfirmDialog, Sheet } from './overlays';
import { useToast } from './toast';
import { Button, Field, FormError, IconButton, TopBar, cx } from './ui';

type Item = { key: string; exercise: ExerciseRow; sets: string; reps: string; duration: string; distanceKm: string; weight: string; rest: string };

let seq = 0;
const newKey = () => `i${++seq}`;

function toItem(e: ExerciseRow, units: Units, t?: TemplateItem): Item {
  return {
    key: newKey(),
    exercise: e,
    sets: String(t?.sets ?? 3),
    reps: String(t?.reps ?? (e.measurement_type === 'reps' || e.measurement_type === 'weight_reps' ? 10 : '')),
    duration: String(t?.duration_seconds ?? (e.measurement_type === 'time' ? 30 : '')),
    distanceKm: t?.distance_meters ? String(Number(t.distance_meters) / 1000) : e.measurement_type === 'distance' ? '2' : '',
    weight: t?.weight_kg !== null && t?.weight_kg !== undefined ? String(displayWeight(Number(t.weight_kg), units)) : '',
    rest: String(t?.rest_seconds ?? 30),
  };
}

const num = (s: string) => (s.trim() === '' ? null : Number(s));

/** Create or edit a custom workout: details, ordered exercises and per-type targets. Saved atomically by save_workout_template. */
export function WorkoutBuilder({ exercises, units, initial }: { exercises: ExerciseRow[]; units: Units; initial: { template: TemplateRow; items: TemplateItem[] } | null }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [pending, start] = useTransition();
  const t = initial?.template;
  const [name, setName] = useState(t?.name ?? '');
  const [description, setDescription] = useState(t?.description ?? '');
  const [category, setCategory] = useState<Category>(t?.category ?? 'strength');
  const [difficulty, setDifficulty] = useState<Difficulty>(t?.difficulty ?? 'beginner');
  const [equipment, setEquipment] = useState<Equipment>(t?.equipment ?? 'none');
  const [minutes, setMinutes] = useState(String(t?.estimated_minutes ?? 20));
  const [items, setItems] = useState<Item[]>(() => initial?.items.map((i) => toItem(i.exercise, units, i)) ?? []);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const filtered = useMemo(() => exercises.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 60), [exercises, query]);
  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const move = (index: number, dir: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      const [it] = next.splice(index, 1);
      next.splice(index + dir, 0, it);
      return next;
    });

  const save = () =>
    start(async () => {
      const r = await saveTemplate({
        id: t?.id ?? null,
        name,
        description,
        category,
        difficulty,
        equipment,
        estimatedMinutes: Number(minutes) || 0,
        items: items.map((i) => {
          const m = i.exercise.measurement_type;
          const w = num(i.weight);
          const d = num(i.distanceKm);
          return {
            exerciseId: i.exercise.id,
            measurementType: m,
            sets: Number(i.sets) || 0,
            reps: m === 'reps' || m === 'weight_reps' ? num(i.reps) : null,
            durationSeconds: m === 'time' ? num(i.duration) : null,
            distanceMeters: m === 'distance' && d !== null ? Math.round(d * 1000) : null,
            weightKg: m === 'weight_reps' && w !== null ? toKg(w, units) : null,
            restSeconds: Number(i.rest) || 0,
          };
        }),
      });
      if (!r.ok) {
        setErrors(r.fields ?? {});
        setFormError(r.error);
        return;
      }
      toast({ title: t ? 'Workout updated' : 'Workout created', message: name });
      router.replace(`/workouts/${r.data.id}`);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!t) return;
      const r = await deleteTemplate(t.id);
      if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t delete', message: r.error });
      toast({ title: 'Workout deleted', message: t.name });
      router.replace('/workouts');
      router.refresh();
    });

  const small = (key: string, label: string, value: string, onChange: (v: string) => void, suffix: string, err?: string) => (
    <label className="flex flex-col gap-1 t-caption text-text-muted" htmlFor={key}>
      {label}
      <span className={cx('flex h-11 items-center gap-1 rounded-[12px] bg-surface-muted px-3', err && 'ring-[1.5px] ring-error')}>
        <input id={key} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, '').slice(0, 6))} className="w-full min-w-0 bg-transparent t-item text-text outline-none" aria-invalid={!!err} />
        <span className="t-caption">{suffix}</span>
      </span>
    </label>
  );

  const selectRow = <T extends string>(label: string, value: T, options: readonly T[], labels: Record<T, string>, onChange: (v: T) => void) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-${label}`} className="t-label text-text-secondary">
        {label}
      </label>
      <select
        id={`${id}-${label}`}
        value={value}
        onChange={(e) => {
          const v = options.find((o) => o === e.target.value);
          if (v) onChange(v);
        }}
        className="h-14 rounded-[18px] border border-border bg-surface px-4 t-item"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col gap-4 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-36">
      <TopBar title={t ? 'Edit workout' : 'Build a workout'} close={t ? `/workouts/${t.id}` : '/workouts'} right={t ? <IconButton icon={Trash2} label="Delete workout" onClick={() => setConfirmDelete(true)} /> : undefined} />
      <FormError message={formError} />
      <Field id={`${id}-name`} label="Name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="e.g. Lunch-break strength" />
      <Field id={`${id}-desc`} label="Description (optional)" maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} />
      <div className="grid grid-cols-2 gap-3">
        {selectRow('Category', category, CATEGORIES, CATEGORY_LABEL, setCategory)}
        {selectRow('Level', difficulty, DIFFICULTIES, DIFFICULTY_LABEL, setDifficulty)}
        {selectRow('Equipment', equipment, EQUIPMENT, EQUIPMENT_LABEL, setEquipment)}
        <Field id={`${id}-min`} label="About (minutes)" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))} error={errors.estimatedMinutes} />
      </div>

      <section aria-labelledby={`${id}-ex`} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id={`${id}-ex`} className="t-section">
            Exercises · {items.length}
          </h2>
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => setPicker(true)}>
            Add
          </Button>
        </div>
        {errors.items ? <p className="t-label text-error">{errors.items}</p> : null}
        <ol className="flex flex-col gap-3">
          {items.map((it, i) => {
            const m = it.exercise.measurement_type;
            const err = (f: string) => errors[`items.${i}.${f}`] ?? errors[`items.${i}`];
            return (
              <li key={it.key} className="flex flex-col gap-3 rounded-[24px] bg-surface p-4">
                <div className="flex items-center gap-2">
                  <span className="t-caption text-text-muted num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="t-card-title min-w-0 flex-1 truncate">{it.exercise.name}</span>
                  <IconButton icon={ArrowUp} label={`Move ${it.exercise.name} up`} look="muted" size="sm" disabled={i === 0} onClick={() => move(i, -1)} />
                  <IconButton icon={ArrowDown} label={`Move ${it.exercise.name} down`} look="muted" size="sm" disabled={i === items.length - 1} onClick={() => move(i, 1)} />
                  <IconButton icon={X} label={`Remove ${it.exercise.name}`} look="muted" size="sm" onClick={() => setItems(items.filter((x) => x.key !== it.key))} />
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {small(`${it.key}-sets`, 'Sets', it.sets, (v) => update(it.key, { sets: v }), '', errors[`items.${i}.sets`])}
                  {m === 'time' ? small(`${it.key}-dur`, 'Hold', it.duration, (v) => update(it.key, { duration: v }), 's', err('durationSeconds')) : null}
                  {m === 'reps' || m === 'weight_reps' ? small(`${it.key}-reps`, 'Reps', it.reps, (v) => update(it.key, { reps: v }), '', err('reps')) : null}
                  {m === 'weight_reps' ? small(`${it.key}-w`, 'Weight', it.weight, (v) => update(it.key, { weight: v }), weightLabel(units), err('weightKg')) : null}
                  {m === 'distance' ? small(`${it.key}-km`, 'Distance', it.distanceKm, (v) => update(it.key, { distanceKm: v }), 'km', err('distanceMeters')) : null}
                  {small(`${it.key}-rest`, 'Rest', it.rest, (v) => update(it.key, { rest: v }), 's', errors[`items.${i}.restSeconds`])}
                </div>
              </li>
            );
          })}
        </ol>
        {!items.length ? <p className="rounded-[20px] bg-surface p-5 t-body text-text-secondary">Add exercises from the library to build your workout.</p> : null}
      </section>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-bg from-70% to-transparent px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[600px]">
          <Button full loading={pending} onClick={save}>
            {t ? 'Save workout' : 'Create workout'}
          </Button>
        </div>
      </div>

      <Sheet open={picker} onClose={() => setPicker(false)} title="Add exercise">
        <div className="sticky top-0 z-10 mb-3 flex h-12 items-center gap-2 rounded-full bg-surface-muted px-4">
          <Search size={16} className="text-text-muted" aria-hidden />
          <label htmlFor={`${id}-q`} className="sr-only">
            Search exercises
          </label>
          <input id={`${id}-q`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercises" className="h-full flex-1 bg-transparent t-item outline-none" />
        </div>
        <ul className="flex flex-col gap-1">
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  setItems((list) => [...list, toItem(e, units)]);
                  toast({ title: 'Added', message: e.name });
                }}
                className="flex min-h-14 w-full items-center gap-3 rounded-[16px] px-3 text-left hover:bg-surface-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="t-item block truncate">{e.name}</span>
                  <span className="t-caption text-text-muted">{CATEGORY_LABEL[e.category]}</span>
                </span>
                <Plus size={18} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
      {t ? (
        <ConfirmDialog open={confirmDelete} title="Delete this workout?" message="Past sessions stay in your history. Saved and planned entries for it are removed." cancelLabel="Keep it" confirmLabel="Delete workout" danger loading={pending} onCancel={() => setConfirmDelete(false)} onConfirm={remove} />
      ) : null}
    </main>
  );
}
