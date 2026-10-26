'use client';

import { BellRing, CalendarDays, Info, PersonStanding, Scale, Timer, Trophy, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';

import { deleteGoal, saveGoal, setGoalStatus } from '@/app/actions/goals';
import { GOAL_META } from '@/lib/domain/goals';
import { displayWeight, toKg, weightLabel } from '@/lib/domain/units';
import { CATEGORY_LABEL } from '@/lib/domain/workouts';
import { CATEGORIES, type FieldErrors } from '@/lib/validations';
import type { Category, GoalRow, GoalType, GoalUnit, MeasurementType, Units } from '@/types/database';
import { ConfirmDialog, Stepper, Toggle } from './overlays';
import { useToast } from './toast';
import { Button, FieldMessage, FormError, InfoNote, TopBar, cx } from './ui';

const ICONS: Record<GoalType, LucideIcon> = { workout_frequency: CalendarDays, active_minutes: Timer, habit: PersonStanding, milestone: Trophy, body_weight: Scale };
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MILESTONE_UNIT: Record<MeasurementType, GoalUnit> = { time: 'seconds', reps: 'reps', weight_reps: 'kg', distance: 'reps' };

interface Props {
  goal: GoalRow | null;
  initialType: GoalType | null;
  takenTypes: GoalType[];
  exercises: { id: string; name: string; measurement_type: MeasurementType }[];
  hints: { avgPerWeek: number; minutesThisWeek: number; latestWeightKg: number | null };
  units: Units;
  today: string;
}

/** Figma 08d New goal / 08b Edit goal. Targets use the right unit per goal type; weight is entered in the user's units. */
export function GoalForm({ goal, initialType, takenTypes, exercises, hints, units, today }: Props) {
  const router = useRouter();
  const toast = useToast();
  const ids = { title: useId(), ex: useId(), date: useId() };
  const [pending, start] = useTransition();
  const [type, setType] = useState<GoalType>(initialType ?? (['workout_frequency', 'active_minutes', 'habit', 'milestone'] as GoalType[]).find((t) => !takenTypes.includes(t)) ?? 'habit');
  const [exerciseId, setExerciseId] = useState<string>(goal?.exercise_id ?? exercises.find((e) => e.name === 'Plank')?.id ?? exercises[0]?.id ?? '');
  const exercise = exercises.find((e) => e.id === exerciseId);
  const initialTarget = (t: GoalType) => (goal && goal.goal_type === t ? Number(goal.target_value) : t === 'body_weight' && hints.latestWeightKg ? Math.round(hints.latestWeightKg) - 2 : GOAL_META[t].defaultTarget);
  const [target, setTarget] = useState(() => (type === 'body_weight' ? displayWeight(initialTarget(type), units) : initialTarget(type)));
  const [title, setTitle] = useState(goal?.title ?? '');
  const [categories, setCategories] = useState<Category[]>(goal?.habit_categories ?? ['mobility', 'stretching']);
  const [days, setDays] = useState<number[]>(goal?.preferred_days ?? []);
  const [reminder, setReminder] = useState(goal?.reminder_enabled ?? false);
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const meta = GOAL_META[type];
  const unit: GoalUnit = type === 'milestone' ? MILESTONE_UNIT[exercise?.measurement_type ?? 'time'] : meta.unit;
  const caption = type === 'workout_frequency' || type === 'habit' ? 'sessions / week' : type === 'active_minutes' ? 'minutes / week' : type === 'body_weight' ? weightLabel(units) : unit === 'seconds' ? 'seconds' : unit;
  const defaultTitle = type === 'workout_frequency' ? 'Weekly workouts' : type === 'active_minutes' ? 'Active minutes' : type === 'habit' ? `${categories.map((c) => CATEGORY_LABEL[c]).join(' & ') || 'Workout'} habit` : type === 'milestone' ? `${exercise?.name ?? 'Exercise'}: ${target} ${unit === 'seconds' ? 'sec' : unit}` : `Reach ${target} ${weightLabel(units)}`;
  const step = type === 'body_weight' ? 0.5 : type === 'milestone' && unit === 'kg' ? 2.5 : meta.step;
  const [min, max] = type === 'body_weight' ? (units === 'metric' ? [20, 400] : [45, 880]) : [meta.min, meta.max];

  const hint =
    type === 'workout_frequency'
      ? `You averaged ${hints.avgPerWeek} workouts a week over the last 4 weeks.${target > hints.avgPerWeek + 1 ? ` ${target} is a stretch — you can lower it anytime.` : ''}`
      : type === 'active_minutes'
        ? `About ${Math.round(target / 7)}–${Math.round(target / 5)} minutes on most days. You’re at ${hints.minutesThisWeek} min this week.`
        : type === 'body_weight'
          ? hints.latestWeightKg
            ? `Your latest weigh-in is ${displayWeight(hints.latestWeightKg, units)} ${weightLabel(units)}. Progress uses your weigh-ins.`
            : 'Log your weight in Body measurements to track progress toward this goal.'
          : type === 'milestone'
            ? 'Progress uses your best completed set of this exercise.'
            : 'Counts finished sessions of the chosen types each week.';

  const changeType = (t: GoalType) => {
    setType(t);
    setTarget(t === 'body_weight' ? displayWeight(initialTarget(t), units) : initialTarget(t));
    setErrors({});
  };

  const save = () =>
    start(async () => {
      const targetValue = type === 'body_weight' ? toKg(target, units) : target;
      const r = await saveGoal({
        id: goal?.id ?? null,
        goalType: type,
        title: title.trim() || defaultTitle,
        targetValue,
        unit,
        habitCategories: categories,
        exerciseId: type === 'milestone' ? exerciseId || null : null,
        preferredDays: days,
        reminderEnabled: reminder,
        targetDate: targetDate || null,
      });
      if (!r.ok) {
        setErrors(r.fields ?? {});
        setFormError(r.error);
        return;
      }
      toast({ title: goal ? 'Goal updated' : 'Goal created', message: title.trim() || defaultTitle });
      router.replace('/goals');
      router.refresh();
    });

  const status = (s: 'active' | 'completed' | 'archived') =>
    start(async () => {
      if (!goal) return;
      const r = await setGoalStatus(goal.id, s);
      if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t update goal', message: r.error });
      toast({ title: s === 'completed' ? 'Goal marked complete' : s === 'archived' ? 'Goal archived' : 'Goal reactivated' });
      router.replace('/goals');
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!goal) return;
      const r = await deleteGoal(goal.id);
      if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t delete goal', message: r.error });
      toast({ title: 'Goal deleted' });
      router.replace('/goals');
      router.refresh();
    });

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-4 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-36">
      <TopBar title={goal ? 'Edit goal' : 'New goal'} close="/goals" />
      <FormError message={formError} />

      {goal ? (
        <div className="rounded-[24px] bg-surface p-5">
          <label htmlFor={ids.title} className="t-body text-text-muted">
            Goal
          </label>
          <input id={ids.title} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full bg-transparent t-title outline-none" aria-invalid={!!errors.title} />
          <FieldMessage id={`${ids.title}-m`} error={errors.title} />
        </div>
      ) : (
        <>
          <h1 className="t-title">What would you like to work toward?</h1>
          <div role="radiogroup" aria-label="Goal type" className="flex flex-col gap-3">
            {(Object.keys(GOAL_META) as GoalType[]).map((t) => {
              const Icon = ICONS[t];
              const on = type === t;
              const taken = takenTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={taken}
                  onClick={() => changeType(t)}
                  className={cx('flex items-center gap-4 rounded-[24px] bg-surface p-4 text-left disabled:opacity-50', on && 'ring-[1.5px] ring-ink')}
                >
                  <span className={cx('grid size-14 shrink-0 place-items-center rounded-[16px]', on ? 'bg-brand text-white' : 'bg-brand-soft text-brand')}>
                    <Icon size={24} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="t-card-title block">{GOAL_META[t].title}</span>
                    <span className="t-body text-text-muted">{taken ? 'You already have one active' : GOAL_META[t].subtitle}</span>
                  </span>
                  <span className={cx('grid size-6 shrink-0 place-items-center rounded-full border-2', on ? 'border-ink' : 'border-disabled')} aria-hidden>
                    {on ? <span className="size-2.5 rounded-full bg-brand" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {type === 'habit' ? (
        <div className="rounded-[24px] bg-surface p-5">
          <p className="t-body text-text-muted">Workout types that count</p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Workout types">
            {CATEGORIES.map((c) => {
              const on = categories.includes(c);
              return (
                <button key={c} type="button" aria-pressed={on} onClick={() => setCategories(on ? categories.filter((x) => x !== c) : [...categories, c])} className={cx('h-10 rounded-full px-4 t-body-m', on ? 'bg-ink text-on-ink' : 'bg-surface-muted')}>
                  {CATEGORY_LABEL[c]}
                </button>
              );
            })}
          </div>
          <FieldMessage id="habit-m" error={errors.habitCategories} />
        </div>
      ) : null}

      {type === 'milestone' ? (
        <div className="rounded-[24px] bg-surface p-5">
          <label htmlFor={ids.ex} className="t-body text-text-muted">
            Exercise
          </label>
          <select id={ids.ex} value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} className="mt-2 h-12 w-full rounded-[14px] border border-border bg-surface px-3 t-item">
            {exercises
              .filter((e) => e.measurement_type !== 'distance')
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
          <FieldMessage id="ex-m" error={errors.exerciseId} />
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-[24px] bg-surface p-5">
        <p className="t-body text-text-muted">{type === 'workout_frequency' ? 'Workouts per week' : type === 'body_weight' ? 'Target weight' : type === 'milestone' ? 'Target' : 'Weekly target'}</p>
        <Stepper value={target} onChange={setTarget} min={min} max={max} step={step} caption={caption} label="Target" />
        <FieldMessage id="target-m" error={errors.targetValue} />
        {type === 'workout_frequency' || type === 'active_minutes' ? (
          <InfoNote icon={Info}>{hint}</InfoNote>
        ) : (
          <p className="t-body text-text-secondary">{hint}</p>
        )}
      </div>

      {type === 'workout_frequency' || type === 'habit' ? (
        <div className="rounded-[24px] bg-surface p-5">
          <p className="t-body text-text-muted">Preferred days</p>
          <div className="mt-3 flex justify-between gap-1" role="group" aria-label="Preferred days">
            {DAYS.map((d, i) => {
              const n = i + 1;
              const on = days.includes(n);
              return (
                <button key={n} type="button" aria-pressed={on} aria-label={DAY_NAMES[i]} onClick={() => setDays(on ? days.filter((x) => x !== n) : [...days, n])} className={cx('grid size-11 place-items-center rounded-full t-body-m', on ? 'bg-ink text-on-ink' : 'bg-surface-muted text-text-secondary')}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5 rounded-[24px] bg-surface p-5">
        <label htmlFor={ids.date} className="t-body text-text-muted">
          Target date (optional)
        </label>
        <input id={ids.date} type="date" min={goal ? undefined : today} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="h-12 rounded-[14px] border border-border bg-surface px-3 t-item" />
        <FieldMessage id={`${ids.date}-m`} error={errors.targetDate} />
      </div>

      <div className="flex items-center gap-4 rounded-[24px] bg-surface p-4">
        <span className="grid size-11 place-items-center rounded-[14px] bg-surface-muted">
          <BellRing size={20} aria-hidden />
        </span>
        <span className="t-item flex-1">Remind me (in-app)</span>
        <Toggle checked={reminder} onChange={setReminder} label="Goal reminders" />
      </div>

      {goal ? (
        <div className="flex flex-wrap gap-2">
          {goal.status === 'active' ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => status('completed')} disabled={pending}>
                Mark complete
              </Button>
              <Button size="sm" variant="secondary" onClick={() => status('archived')} disabled={pending}>
                Archive
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => status('active')} disabled={pending}>
              Reactivate
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)} disabled={pending}>
            Delete
          </Button>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-bg from-70% to-transparent px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[520px]">
          <Button full loading={pending} onClick={save}>
            {goal ? 'Save goal' : 'Create goal'}
          </Button>
        </div>
      </div>
      <ConfirmDialog open={confirmDelete} title="Delete this goal?" message="Your workouts stay; only the goal is removed." cancelLabel="Keep it" confirmLabel="Delete goal" danger loading={pending} onCancel={() => setConfirmDelete(false)} onConfirm={remove} />
    </main>
  );
}
