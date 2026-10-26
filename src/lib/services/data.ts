import 'server-only';

import { addDays, localDate, type DateRange, type LocalDate } from '@/lib/domain/dates';
import type { ServerClient } from '@/lib/supabase/server';
import type {
  Category,
  ExerciseRow,
  ExerciseSetRow,
  GoalRow,
  MeasurementRow,
  NotificationRow,
  PlannedWorkoutRow,
  ProfileRow,
  TemplateExerciseRow,
  TemplateRow,
  WorkoutExerciseRow,
  WorkoutRow,
} from '@/types/database';

/**
 * Read services. Each query runs as the signed-in user, so Row Level Security limits results
 * to their own rows (plus the shared catalog). Errors are logged without row data and rethrown
 * as a generic message for the route's error boundary.
 */
export class DataError extends Error {}

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error) {
    console.error(`[pulsefit] ${what} failed: ${res.error.code ?? ''} ${res.error.message}`);
    throw new DataError(`Couldn’t load ${what}.`);
  }
  return res.data as T;
}

// ───────────── Profile ─────────────

export async function findProfile(db: ServerClient, userId: string): Promise<ProfileRow | null> {
  return check(await db.from('profiles').select('*').eq('id', userId).maybeSingle(), 'your profile');
}

export async function getProfile(db: ServerClient, userId: string): Promise<ProfileRow> {
  const profile = await findProfile(db, userId);
  if (!profile) throw new DataError('Your profile is missing. Try signing out and in again.');
  return profile;
}

export function todayFor(profile: Pick<ProfileRow, 'timezone'>): LocalDate {
  return localDate(new Date(), profile.timezone);
}

// ───────────── Catalog ─────────────

export interface TemplateFilters {
  category?: Category | null;
  q?: string;
  minMinutes?: number;
  maxMinutes?: number;
}

export async function listTemplates(db: ServerClient, f: TemplateFilters = {}): Promise<TemplateRow[]> {
  let q = db.from('workout_templates').select('*').order('is_popular', { ascending: false }).order('estimated_minutes').limit(100);
  if (f.category) q = q.eq('category', f.category);
  if (f.minMinutes !== undefined) q = q.gte('estimated_minutes', f.minMinutes);
  if (f.maxMinutes !== undefined) q = q.lte('estimated_minutes', f.maxMinutes);
  if (f.q) q = q.ilike('name', `%${escapeLike(f.q)}%`);
  return check(await q, 'workouts');
}

export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`).slice(0, 60);
}

export type TemplateItem = TemplateExerciseRow & { exercise: ExerciseRow };

export async function getTemplate(db: ServerClient, id: string): Promise<{ template: TemplateRow; items: TemplateItem[] } | null> {
  const template = check(await db.from('workout_templates').select('*').eq('id', id).maybeSingle(), 'this workout');
  if (!template) return null;
  const rows = check(await db.from('workout_template_exercises').select('*').eq('template_id', id).order('sort_order'), 'exercises');
  const exercises = rows.length ? check(await db.from('exercises').select('*').in('id', rows.map((r) => r.exercise_id)), 'exercises') : [];
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const items = rows.flatMap((r) => {
    const exercise = byId.get(r.exercise_id);
    return exercise ? [{ ...r, exercise }] : [];
  });
  return { template, items };
}

export async function listExercises(db: ServerClient, f: { category?: Category | null; q?: string } = {}): Promise<ExerciseRow[]> {
  let q = db.from('exercises').select('*').order('name').limit(200);
  if (f.category) q = q.eq('category', f.category);
  if (f.q) q = q.ilike('name', `%${escapeLike(f.q)}%`);
  return check(await q, 'exercises');
}

export async function getExercise(db: ServerClient, id: string): Promise<ExerciseRow | null> {
  return check(await db.from('exercises').select('*').eq('id', id).maybeSingle(), 'this exercise');
}

export async function savedTemplateIds(db: ServerClient, userId: string): Promise<Set<string>> {
  const rows = check(await db.from('saved_workouts').select('template_id, created_at').eq('user_id', userId), 'saved workouts');
  return new Set(rows.map((r) => r.template_id));
}

export async function listSaved(db: ServerClient, userId: string): Promise<(TemplateRow & { saved_at: string })[]> {
  const rows = check(await db.from('saved_workouts').select('template_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }), 'saved workouts');
  if (!rows.length) return [];
  const tpls = check(await db.from('workout_templates').select('*').in('id', rows.map((r) => r.template_id)), 'saved workouts');
  const byId = new Map(tpls.map((t) => [t.id, t]));
  return rows.flatMap((r) => {
    const t = byId.get(r.template_id);
    return t ? [{ ...t, saved_at: r.created_at }] : [];
  });
}

export async function plannedInRange(db: ServerClient, userId: string, range: DateRange): Promise<PlannedWorkoutRow[]> {
  return check(await db.from('planned_workouts').select('*').eq('user_id', userId).gte('planned_date', range.start).lte('planned_date', range.end), 'your plan');
}

// ───────────── Sessions ─────────────

const HISTORY_LIMIT = 200;

export async function listWorkouts(db: ServerClient, userId: string, opts: { range?: DateRange; category?: Category | null; limit?: number } = {}): Promise<WorkoutRow[]> {
  let q = db.from('workouts').select('*').eq('user_id', userId).order('workout_date', { ascending: false }).order('started_at', { ascending: false }).limit(opts.limit ?? HISTORY_LIMIT);
  if (opts.range) q = q.gte('workout_date', opts.range.start).lte('workout_date', opts.range.end);
  if (opts.category) q = q.eq('category', opts.category);
  return check(await q, 'your workouts');
}

/** Workouts from the last `days` days (default ~13 weeks) — enough for weekly stats, streaks and averages. */
export async function recentWorkouts(db: ServerClient, userId: string, today: LocalDate, days = 92): Promise<WorkoutRow[]> {
  return listWorkouts(db, userId, { range: { start: addDays(today, -days), end: addDays(today, 1) }, limit: 500 });
}

export async function activeWorkout(db: ServerClient, userId: string): Promise<WorkoutRow | null> {
  return check(await db.from('workouts').select('*').eq('user_id', userId).eq('status', 'in_progress').maybeSingle(), 'your active workout');
}

export type SessionDetail = WorkoutRow & { exercises: (WorkoutExerciseRow & { sets: ExerciseSetRow[] })[] };

export async function getSession(db: ServerClient, id: string): Promise<SessionDetail | null> {
  const w: WorkoutRow | null = check(await db.from('workouts').select('*').eq('id', id).maybeSingle(), 'this session');
  if (!w) return null;
  const exercises = check(await db.from('workout_exercises').select('*').eq('workout_id', id).order('sort_order'), 'exercises');
  const sets = exercises.length ? check(await db.from('exercise_sets').select('*').in('workout_exercise_id', exercises.map((e) => e.id)).order('set_number'), 'sets') : [];
  return { ...w, exercises: exercises.map((e) => ({ ...e, sets: sets.filter((s) => s.workout_exercise_id === e.id) })) };
}

/** Per-workout exercise progress for history lists (one query for all ids). */
export async function exerciseCounts(db: ServerClient, workoutIds: string[]): Promise<Map<string, { done: number; total: number }>> {
  const out = new Map<string, { done: number; total: number }>();
  if (!workoutIds.length) return out;
  const exercises = check(await db.from('workout_exercises').select('id, workout_id').in('workout_id', workoutIds), 'exercises');
  const sets = exercises.length ? check(await db.from('exercise_sets').select('workout_exercise_id, completed').in('workout_exercise_id', exercises.map((e) => e.id)), 'sets') : [];
  const open = new Set(sets.filter((s) => !s.completed).map((s) => s.workout_exercise_id));
  const hasSets = new Set(sets.map((s) => s.workout_exercise_id));
  for (const e of exercises) {
    const c = out.get(e.workout_id) ?? { done: 0, total: 0 };
    c.total += 1;
    if (hasSets.has(e.id) && !open.has(e.id)) c.done += 1;
    out.set(e.workout_id, c);
  }
  return out;
}

/** Completed sets for one exercise across the user's sessions (milestones, personal bests). */
export async function setsForExercise(db: ServerClient, exerciseId: string): Promise<ExerciseSetRow[]> {
  const wes = check(await db.from('workout_exercises').select('id').eq('exercise_id', exerciseId).limit(500), 'exercise history');
  if (!wes.length) return [];
  return check(await db.from('exercise_sets').select('*').in('workout_exercise_id', wes.map((w) => w.id)).eq('completed', true), 'exercise history');
}

// ───────────── Goals, measurements, notifications ─────────────

export async function listGoals(db: ServerClient, userId: string, includeArchived = false): Promise<GoalRow[]> {
  let q = db.from('fitness_goals').select('*').eq('user_id', userId).order('created_at');
  if (!includeArchived) q = q.neq('status', 'archived');
  return check(await q, 'your goals');
}

export async function getGoal(db: ServerClient, id: string): Promise<GoalRow | null> {
  return check(await db.from('fitness_goals').select('*').eq('id', id).maybeSingle(), 'this goal');
}

export async function listMeasurements(db: ServerClient, userId: string, type?: MeasurementRow['measurement_type'], since?: string): Promise<MeasurementRow[]> {
  let q = db.from('body_measurements').select('*').eq('user_id', userId).order('measured_at', { ascending: false }).limit(365);
  if (type) q = q.eq('measurement_type', type);
  if (since) q = q.gte('measured_at', since);
  return check(await q, 'your measurements');
}

export async function listNotifications(db: ServerClient, userId: string): Promise<NotificationRow[]> {
  return check(await db.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(60), 'notifications');
}

export async function unreadCount(db: ServerClient, userId: string): Promise<number> {
  const res = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null);
  if (res.error) return 0;
  return res.count ?? 0;
}
