'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { dbFail, fail, invalid, ok, type ActionResult } from '@/lib/action-result';
import { weekRange } from '@/lib/domain/dates';
import { goalProgress } from '@/lib/domain/goals';
import { weekStreak } from '@/lib/domain/workouts';
import { getProfile, recentWorkouts, setsForExercise, todayFor } from '@/lib/services/data';
import { requireUser, type ServerClient } from '@/lib/supabase/server';
import { finishSchema, sessionEditSchema, setValuesSchema, validateSetForType } from '@/lib/validations';

const idSchema = z.guid();

export async function startWorkout(templateId: string): Promise<ActionResult<{ workoutId: string }>> {
  if (!idSchema.safeParse(templateId).success) return fail('That workout doesn’t exist.');
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase.rpc('start_workout', { p_template_id: templateId });
  if (error) {
    if (error.code === '23505') {
      // Already running (e.g. double tap or another tab): resume that session instead.
      const { data: active } = await supabase.from('workouts').select('id').eq('user_id', userId).eq('status', 'in_progress').maybeSingle();
      if (active) return ok({ workoutId: active.id });
    }
    return dbFail('start_workout', error);
  }
  return ok({ workoutId: data });
}

export async function saveSet(workoutId: string, input: z.input<typeof setValuesSchema>): Promise<ActionResult> {
  const parsed = setValuesSchema.safeParse(input);
  if (!parsed.success || !idSchema.safeParse(workoutId).success) return parsed.success ? fail('Invalid session.') : invalid(parsed.error);
  const { supabase } = await requireUser();
  // Load the set through its parent exercise and workout: RLS hides rows the user doesn't own,
  // and the workout must still be in progress.
  const { data: set, error } = await supabase.from('exercise_sets').select('id, workout_exercise_id').eq('id', parsed.data.setId).maybeSingle();
  if (error) return dbFail('saveSet.load', error);
  if (!set) return fail('That set no longer exists.');
  const { data: we } = await supabase.from('workout_exercises').select('measurement_type, workout_id').eq('id', set.workout_exercise_id).maybeSingle();
  if (!we || we.workout_id !== workoutId) return fail('That set isn’t part of this workout.');
  const { data: w } = await supabase.from('workouts').select('status').eq('id', workoutId).maybeSingle();
  if (!w) return fail('This workout no longer exists.');
  const msg = validateSetForType(we.measurement_type, parsed.data);
  if (msg) return fail(msg);
  const v = parsed.data;
  const upd = await supabase
    .from('exercise_sets')
    .update({
      reps: v.reps,
      weight_kg: v.weightKg,
      duration_seconds: v.durationSeconds,
      distance_meters: v.distanceMeters,
      completed: v.completed,
      completed_at: v.completed ? new Date().toISOString() : null,
    })
    .eq('id', v.setId);
  if (upd.error) return dbFail('saveSet.update', upd.error);
  if (w.status !== 'in_progress') revalidatePath(`/history/${workoutId}`);
  return ok(undefined);
}

export async function setPaused(workoutId: string, paused: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(workoutId).success) return fail('Invalid session.');
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('set_workout_paused', { p_workout_id: workoutId, p_paused: paused });
  return error ? dbFail('set_workout_paused', error) : ok(undefined);
}

export async function finishWorkout(input: z.input<typeof finishSchema>): Promise<ActionResult<{ durationSeconds: number }>> {
  const parsed = finishSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase.rpc('finish_workout', { p_workout_id: parsed.data.workoutId, p_status: parsed.data.status, p_effort: parsed.data.effort });
  if (error) return dbFail('finish_workout', error);
  try {
    await recordAchievements(supabase, userId, parsed.data.workoutId);
  } catch (e) {
    // Notifications are a bonus; never fail a saved workout because of them.
    console.error('[pulsefit] achievements', e instanceof Error ? e.message : 'unknown');
  }
  revalidatePath('/', 'layout');
  return ok({ durationSeconds: data ?? 0 });
}

/** Discards an unfinished session entirely (nothing is kept in history). */
export async function discardWorkout(workoutId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(workoutId).success) return fail('Invalid session.');
  const { supabase, userId } = await requireUser();
  const { error, count } = await supabase.from('workouts').delete({ count: 'exact' }).eq('id', workoutId).eq('user_id', userId).eq('status', 'in_progress');
  if (error) return dbFail('discardWorkout', error);
  if (!count) return fail('This session has already ended.');
  revalidatePath('/', 'layout');
  return ok(undefined);
}

export async function updateSession(input: z.input<typeof sessionEditSchema>): Promise<ActionResult> {
  const parsed = sessionEditSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await requireUser();
  const { error, count } = await supabase
    .from('workouts')
    .update({ notes: parsed.data.notes, effort: parsed.data.effort, duration_seconds: parsed.data.durationMinutes * 60 }, { count: 'exact' })
    .eq('id', parsed.data.workoutId)
    .neq('status', 'in_progress');
  if (error) return dbFail('updateSession', error);
  if (!count) return fail('That session no longer exists.');
  revalidatePath('/', 'layout');
  return ok(undefined);
}

export async function deleteSession(workoutId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(workoutId).success) return fail('Invalid session.');
  const { supabase } = await requireUser();
  const { error, count } = await supabase.from('workouts').delete({ count: 'exact' }).eq('id', workoutId);
  if (error) return dbFail('deleteSession', error);
  if (!count) return fail('That session no longer exists.');
  revalidatePath('/', 'layout');
  return ok(undefined);
}

/**
 * After a session ends: streak, weekly-goal, habit and personal-best notifications.
 * Each has a dedupe key, so finishing twice or re-running never duplicates them.
 */
async function recordAchievements(db: ServerClient, userId: string, workoutId: string) {
  const profile = await getProfile(db, userId);
  const today = todayFor(profile);
  const week = weekRange(today).start;
  const [workouts, goalsRes] = await Promise.all([recentWorkouts(db, userId, today, 400), db.from('fitness_goals').select('*').eq('user_id', userId).eq('status', 'active')]);
  const goals = goalsRes.data ?? [];
  const notes: { kind: 'streak' | 'habit' | 'personal_best' | 'goal'; title: string; body: string; link: string; dedupe_key: string }[] = [];

  const freq = goals.find((g) => g.goal_type === 'workout_frequency');
  if (freq) {
    const p = goalProgress(freq, { today, workouts });
    if (p.met) {
      const streak = weekStreak(workouts, today, Number(freq.target_value));
      notes.push(
        streak >= 2
          ? { kind: 'streak', title: `${streak}-week streak`, body: `You’ve hit your weekly goal ${streak} weeks in a row.`, link: '/activity', dedupe_key: `streak:${week}` }
          : { kind: 'goal', title: 'Weekly goal reached', body: `${p.label} this week.`, link: '/activity', dedupe_key: `weekly:${week}` },
      );
    }
  }
  for (const g of goals.filter((x) => x.goal_type === 'habit' || x.goal_type === 'active_minutes')) {
    const p = goalProgress(g, { today, workouts });
    if (p.met) notes.push({ kind: 'habit', title: `${g.title} done`, body: `${p.label}.`, link: `/goals/${g.id}`, dedupe_key: `goal:${g.id}:${week}` });
  }

  // Personal bests for milestone exercises done in this session.
  const { data: wes } = await db.from('workout_exercises').select('id, exercise_id, exercise_name_snapshot').eq('workout_id', workoutId);
  for (const g of goals.filter((x) => x.goal_type === 'milestone' && x.exercise_id)) {
    const we = wes?.find((e) => e.exercise_id === g.exercise_id);
    if (!we || !g.exercise_id) continue;
    const all = await setsForExercise(db, g.exercise_id);
    const pick = (s: (typeof all)[number]) => Number((g.unit === 'seconds' ? s.duration_seconds : g.unit === 'kg' ? s.weight_kg : s.reps) ?? 0);
    const thisSession = all.filter((s) => s.workout_exercise_id === we.id).reduce((m, s) => Math.max(m, pick(s)), 0);
    const before = all.filter((s) => s.workout_exercise_id !== we.id).reduce((m, s) => Math.max(m, pick(s)), 0);
    if (thisSession > before && thisSession > 0) {
      const unit = g.unit === 'seconds' ? 'sec' : g.unit === 'kg' ? 'kg' : 'reps';
      const left = Number(g.target_value) - thisSession;
      notes.push({
        kind: 'personal_best',
        title: `New best ${we.exercise_name_snapshot.toLowerCase()}: ${thisSession} ${unit}`,
        body: left > 0 ? `${left} ${unit} to go on your ${g.target_value}-${unit} milestone.` : 'Milestone reached — nice work!',
        link: `/goals/${g.id}`,
        dedupe_key: `pb:${g.id}:${thisSession}`,
      });
    }
  }

  if (notes.length) await db.from('notifications').upsert(notes.map((n) => ({ ...n, user_id: userId })), { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true });
}

export async function setEffort(workoutId: string, effort: 'easy' | 'just_right' | 'hard'): Promise<ActionResult> {
  if (!idSchema.safeParse(workoutId).success || !['easy', 'just_right', 'hard'].includes(effort)) return fail('Invalid input.');
  const { supabase } = await requireUser();
  const { error, count } = await supabase.from('workouts').update({ effort }, { count: 'exact' }).eq('id', workoutId).neq('status', 'in_progress');
  if (error) return dbFail('setEffort', error);
  if (!count) return fail('That session no longer exists.');
  revalidatePath(`/history/${workoutId}`);
  return ok(undefined);
}
