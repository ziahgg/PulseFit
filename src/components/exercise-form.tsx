'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';

import { createExercise } from '@/app/actions/library';
import { CATEGORY_LABEL } from '@/lib/domain/workouts';
import { CATEGORIES, DIFFICULTIES, EQUIPMENT, MEASUREMENT_TYPES, MUSCLE_GROUPS, type FieldErrors } from '@/lib/validations';
import { DIFFICULTY_LABEL, EQUIPMENT_LABEL } from './cards';
import { useToast } from './toast';
import { Button, Field, FieldMessage, FormError, TopBar } from './ui';

const MEASURE_LABEL = { time: 'Time (hold / duration)', reps: 'Reps', weight_reps: 'Reps with weight', distance: 'Distance' } as const;
const MUSCLE_LABEL: Record<(typeof MUSCLE_GROUPS)[number], string> = { full_body: 'Full body', upper_body: 'Upper body', lower_body: 'Lower body', core: 'Core', back: 'Back', chest: 'Chest', shoulders: 'Shoulders', arms: 'Arms', legs: 'Legs', hips: 'Hips', cardio: 'Cardio' };

type Form = {
  name: string;
  description: string;
  category: (typeof CATEGORIES)[number];
  muscleGroup: (typeof MUSCLE_GROUPS)[number];
  equipment: (typeof EQUIPMENT)[number];
  difficulty: (typeof DIFFICULTIES)[number];
  measurementType: (typeof MEASUREMENT_TYPES)[number];
  instructions: string;
};

export function ExerciseForm() {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [pending, start] = useTransition();
  const [v, setV] = useState<Form>({ name: '', description: '', category: 'strength', muscleGroup: 'full_body', equipment: 'none', difficulty: 'beginner', measurementType: 'reps', instructions: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();

  const select = <K extends 'category' | 'muscleGroup' | 'equipment' | 'difficulty' | 'measurementType'>(key: K, label: string, options: readonly Form[K][], labels: Record<Form[K], string>) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-${key}`} className="t-label text-text-secondary">
        {label}
      </label>
      <select id={`${id}-${key}`} value={v[key]} onChange={(e) => {
          const next = options.find((o) => o === e.target.value);
          if (next) setV({ ...v, [key]: next });
        }} className="h-14 rounded-[18px] border border-border bg-surface px-4 t-item">
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </div>
  );

  const save = () =>
    start(async () => {
      const r = await createExercise({
        name: v.name,
        description: v.description,
        category: v.category,
        muscleGroup: v.muscleGroup,
        equipment: v.equipment,
        difficulty: v.difficulty,
        measurementType: v.measurementType,
        instructions: v.instructions.split('\n').map((s) => s.trim()).filter(Boolean),
      });
      if (!r.ok) {
        setErrors(r.fields ?? {});
        setFormError(r.error);
        return;
      }
      toast({ title: 'Exercise added', message: v.name });
      router.replace(`/exercises/${r.data.id}`);
    });

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-4 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-32">
      <TopBar title="New exercise" close="/exercises" />
      <FormError message={formError} />
      <Field id={`${id}-name`} label="Name" maxLength={80} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={errors.name} />
      <Field id={`${id}-desc`} label="Short description (optional)" maxLength={500} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} error={errors.description} />
      {select('measurementType', 'How sets are recorded', MEASUREMENT_TYPES, MEASURE_LABEL)}
      {select('category', 'Category', CATEGORIES, CATEGORY_LABEL)}
      {select('muscleGroup', 'Muscle group', MUSCLE_GROUPS, MUSCLE_LABEL)}
      {select('equipment', 'Equipment', EQUIPMENT, EQUIPMENT_LABEL)}
      {select('difficulty', 'Difficulty', DIFFICULTIES, DIFFICULTY_LABEL)}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-ins`} className="t-label text-text-secondary">
          Steps (one per line, optional)
        </label>
        <textarea id={`${id}-ins`} rows={4} value={v.instructions} onChange={(e) => setV({ ...v, instructions: e.target.value })} className="rounded-[18px] border border-border bg-surface p-4 t-item outline-none focus:border-ink" aria-describedby={`${id}-ins-m`} />
        <FieldMessage id={`${id}-ins-m`} error={errors.instructions} hint="Up to 10 steps" />
      </div>
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-bg from-70% to-transparent px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[520px]">
          <Button full loading={pending} onClick={save}>
            Add exercise
          </Button>
        </div>
      </div>
    </main>
  );
}
