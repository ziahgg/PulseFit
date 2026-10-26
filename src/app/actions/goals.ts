'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { dbFail, fail, invalid, ok, type ActionResult } from '@/lib/action-result';
import { getProfile, todayFor } from '@/lib/services/data';
import { requireUser } from '@/lib/supabase/server';
import { goalSchema, measurementSchema } from '@/lib/validations';

const idSchema = z.guid();

export async function saveGoal(input: z.input<typeof goalSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, userId } = await requireUser();
  const v = parsed.data;
  const row = {
    goal_type: v.goalType,
    title: v.title,
    target_value: v.targetValue,
    unit: v.unit,
    habit_categories: v.goalType === 'habit' ? v.habitCategories : [],
    exercise_id: v.goalType === 'milestone' ? v.exerciseId : null,
    preferred_days: [...new Set(v.preferredDays)].sort(),
    reminder_enabled: v.reminderEnabled,
    target_date: v.targetDate,
  };
  if (v.id) {
    const { error, count } = await supabase.from('fitness_goals').update(row, { count: 'exact' }).eq('id', v.id);
    if (error) return dbFail('updateGoal', error);
    if (!count) return fail('That goal no longer exists.');
    revalidatePath('/', 'layout');
    return ok({ id: v.id });
  }
  const today = todayFor(await getProfile(supabase, userId));
  if (v.targetDate && v.targetDate < today) return fail('Pick a target date in the future.', { targetDate: 'Must be today or later' });
  const { data, error } = await supabase.from('fitness_goals').insert({ ...row, user_id: userId, start_date: today }).select('id').single();
  if (error) {
    if (error.code === '23505') return fail('You already have an active goal of this type. Edit that one instead.');
    return dbFail('createGoal', error);
  }
  revalidatePath('/', 'layout');
  return ok({ id: data.id });
}

export async function setGoalStatus(id: string, status: 'active' | 'completed' | 'archived'): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return fail('That goal doesn’t exist.');
  const { supabase } = await requireUser();
  const { error, count } = await supabase
    .from('fitness_goals')
    .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }, { count: 'exact' })
    .eq('id', id);
  if (error) return dbFail('setGoalStatus', error);
  if (!count) return fail('That goal no longer exists.');
  revalidatePath('/', 'layout');
  return ok(undefined);
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return fail('That goal doesn’t exist.');
  const { supabase } = await requireUser();
  const { error, count } = await supabase.from('fitness_goals').delete({ count: 'exact' }).eq('id', id);
  if (error) return dbFail('deleteGoal', error);
  if (!count) return fail('That goal no longer exists.');
  revalidatePath('/', 'layout');
  return ok(undefined);
}

export async function saveMeasurement(input: z.input<typeof measurementSchema>): Promise<ActionResult> {
  const parsed = measurementSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, userId } = await requireUser();
  const v = parsed.data;
  const unit = v.measurementType === 'weight' ? 'kg' : v.measurementType === 'body_fat' ? 'percent' : 'cm';
  // Midday UTC keeps the chosen calendar day stable across timezones.
  const row = { measurement_type: v.measurementType, value: v.value, unit, measured_at: `${v.measuredAt}T12:00:00Z`, notes: v.notes } as const;
  const res = v.id ? await supabase.from('body_measurements').update(row, { count: 'exact' }).eq('id', v.id) : await supabase.from('body_measurements').insert({ ...row, user_id: userId });
  if (res.error) return dbFail('saveMeasurement', res.error);
  if (v.id && !res.count) return fail('That entry no longer exists.');
  revalidatePath('/measurements');
  revalidatePath('/goals', 'layout');
  return ok(undefined);
}

export async function deleteMeasurement(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return fail('That entry doesn’t exist.');
  const { supabase } = await requireUser();
  const { error, count } = await supabase.from('body_measurements').delete({ count: 'exact' }).eq('id', id);
  if (error) return dbFail('deleteMeasurement', error);
  if (!count) return fail('That entry no longer exists.');
  revalidatePath('/measurements');
  return ok(undefined);
}
