/**
 * Workout calculations. Definitions used everywhere in the app:
 *  - A *finished session* is a workout with status completed or ended_early.
 *  - *Active minutes* = recorded duration of finished sessions, rounded to the nearest minute.
 *  - A day is "active" (dark bar) at 20+ active minutes, "light" below that.
 *  - An exercise counts as done when all of its sets are completed.
 *  - Energy is a labelled estimate range from MET values, never a measurement.
 */
import type { Category, ExerciseSetRow, MeasurementType, WorkoutExerciseRow, WorkoutRow } from '@/types/database';
import { addDays, eachDay, inRange, weekRange, type DateRange, type LocalDate } from './dates';

export type FinishedWorkout = Pick<WorkoutRow, 'status' | 'duration_seconds' | 'workout_date'>;

export const isFinished = (w: Pick<WorkoutRow, 'status'>) => w.status === 'completed' || w.status === 'ended_early';

export const ACTIVE_DAY_MINUTES = 20;

export function activeMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

export function totalActiveMinutes(workouts: FinishedWorkout[], range?: DateRange): number {
  const secs = workouts.filter((w) => isFinished(w) && (!range || inRange(w.workout_date, range))).reduce((s, w) => s + (w.duration_seconds ?? 0), 0);
  return activeMinutes(secs);
}

export function sessionCount(workouts: FinishedWorkout[], range: DateRange): number {
  return workouts.filter((w) => isFinished(w) && inRange(w.workout_date, range)).length;
}

export interface DayBar {
  date: LocalDate;
  minutes: number;
  kind: 'active' | 'light' | 'none' | 'planned' | 'future';
}

/** Per-day active minutes for a range; future days are "planned" if a workout is planned or a preferred day. */
export function dailyBars(workouts: FinishedWorkout[], range: DateRange, today: LocalDate, isPlanned: (d: LocalDate) => boolean): DayBar[] {
  const byDay = new Map<LocalDate, number>();
  for (const w of workouts) if (isFinished(w) && inRange(w.workout_date, range)) byDay.set(w.workout_date, (byDay.get(w.workout_date) ?? 0) + (w.duration_seconds ?? 0));
  return eachDay(range).map((date) => {
    const minutes = activeMinutes(byDay.get(date) ?? 0);
    if (date > today) return { date, minutes: 0, kind: isPlanned(date) ? 'planned' : 'future' };
    return { date, minutes, kind: minutes >= ACTIVE_DAY_MINUTES ? 'active' : minutes > 0 ? 'light' : 'none' };
  });
}

/**
 * Consecutive weeks (Mon–Sun) that met `perWeek` finished sessions, counting back from the
 * current week if it already met the target, otherwise from last week.
 */
export function weekStreak(workouts: FinishedWorkout[], today: LocalDate, perWeek: number): number {
  if (perWeek <= 0) return 0;
  const counts = new Map<LocalDate, number>();
  for (const w of workouts) if (isFinished(w)) counts.set(weekRange(w.workout_date).start, (counts.get(weekRange(w.workout_date).start) ?? 0) + 1);
  let start = weekRange(today).start;
  if ((counts.get(start) ?? 0) < perWeek) start = addDays(start, -7);
  let streak = 0;
  while ((counts.get(start) ?? 0) >= perWeek) {
    streak += 1;
    start = addDays(start, -7);
  }
  return streak;
}

/** "25:40", "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Elapsed active seconds of a session from server timestamps (pauses excluded). */
export function elapsedSeconds(w: Pick<WorkoutRow, 'started_at' | 'ended_at' | 'paused_at' | 'paused_seconds' | 'duration_seconds'>, now: Date): number {
  if (w.duration_seconds !== null && w.ended_at) return w.duration_seconds;
  const end = w.paused_at ? new Date(w.paused_at).getTime() : now.getTime();
  return Math.max(0, Math.floor((end - new Date(w.started_at).getTime()) / 1000) - w.paused_seconds);
}

export type SetLike = Pick<ExerciseSetRow, 'completed'>;

export function exerciseDone(sets: SetLike[]): boolean {
  return sets.length > 0 && sets.every((s) => s.completed);
}

export function exerciseProgress(exercises: { sets: SetLike[] }[]): { done: number; total: number } {
  return { done: exercises.filter((e) => exerciseDone(e.sets)).length, total: exercises.length };
}

/** Index of the first exercise with an open set (or the last one when all are done). */
export function currentExerciseIndex(exercises: { sets: SetLike[] }[]): number {
  const i = exercises.findIndex((e) => !exerciseDone(e.sets));
  return i === -1 ? Math.max(0, exercises.length - 1) : i;
}

/** Fraction (0–1) of all sets completed — drives the segmented progress bar. */
export function setFraction(sets: SetLike[]): number {
  return sets.length ? sets.filter((s) => s.completed).length / sets.length : 0;
}

/** Total volume (kg × reps) for weighted sets. */
export function volumeKg(sets: Pick<ExerciseSetRow, 'completed' | 'reps' | 'weight_kg'>[]): number {
  return Math.round(sets.filter((s) => s.completed).reduce((sum, s) => sum + (s.reps ?? 0) * (s.weight_kg ?? 0), 0) * 100) / 100;
}

/** Short prescription text: "3 × 30 s", "2 × 10 reps", "3 × 10 · 12 kg", "1 × 2 km". */
export function prescription(
  measurement: MeasurementType,
  sets: number,
  t: { reps?: number | null; duration_seconds?: number | null; weight_kg?: number | null; distance_meters?: number | null },
): string {
  if (measurement === 'time') return `${sets} × ${t.duration_seconds ?? 0} s`;
  if (measurement === 'distance') return `${sets} × ${((t.distance_meters ?? 0) / 1000).toFixed(1)} km`;
  if (measurement === 'weight_reps') return `${sets} × ${t.reps ?? 0}${t.weight_kg ? ` · ${t.weight_kg} kg` : ''}`;
  return `${sets} × ${t.reps ?? 0} reps`;
}

/** Approximate MET range per category (Compendium of Physical Activities, rounded). */
const MET: Record<Category, [number, number]> = {
  yoga: [2.5, 3.0],
  breathing: [1.3, 1.5],
  stretching: [2.3, 2.8],
  mobility: [2.5, 3.0],
  core: [3.0, 3.8],
  strength: [3.5, 5.0],
  cardio: [4.0, 6.0],
};

/** Labelled estimate: kcal ≈ MET × kg × hours, rounded to 10 kcal. */
export function energyEstimate(category: Category, seconds: number, bodyKg: number): [number, number] {
  const hours = seconds / 3600;
  const [lo, hi] = MET[category];
  const r = (v: number) => Math.round(v / 10) * 10;
  return [r(lo * bodyKg * hours), r(hi * bodyKg * hours)];
}

export const CATEGORY_LABEL: Record<Category, string> = {
  yoga: 'Yoga',
  strength: 'Strength',
  mobility: 'Mobility',
  cardio: 'Cardio',
  core: 'Core',
  stretching: 'Stretching',
  breathing: 'Breathing',
};

export type SessionExercise = WorkoutExerciseRow & { sets: ExerciseSetRow[] };
