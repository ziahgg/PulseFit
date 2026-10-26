'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { dbFail, fail, invalid, ok, type ActionResult } from '@/lib/action-result';
import { getProfile, todayFor } from '@/lib/services/data';
import { requireUser } from '@/lib/supabase/server';
import { customExerciseSchema, templateSchema } from '@/lib/validations';

const idSchema = z.guid();

export async function setSaved(templateId: string, saved: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(templateId).success) return fail('That workout doesn’t exist.');
  const { supabase, userId } = await requireUser();
  const res = saved
    ? await supabase.from('saved_workouts').upsert({ user_id: userId, template_id: templateId }, { onConflict: 'user_id,template_id', ignoreDuplicates: true })
    : await supabase.from('saved_workouts').delete().eq('user_id', userId).eq('template_id', templateId);
  if (res.error) return dbFail('setSaved', res.error);
  revalidatePath('/', 'layout');
  return ok(undefined);
}

/** Plans a workout for today (one plan per day; replaces the existing one). */
export async function planForToday(templateId: string, time: string | null): Promise<ActionResult> {
  if (!idSchema.safeParse(templateId).success) return fail('That workout doesn’t exist.');
  if (time !== null && !/^\d{2}:\d{2}$/.test(time)) return fail('Choose a valid time.');
  const { supabase, userId } = await requireUser();
  const today = todayFor(await getProfile(supabase, userId));
  const { error } = await supabase.from('planned_workouts').upsert({ user_id: userId, template_id: templateId, planned_date: today, planned_time: time }, { onConflict: 'user_id,planned_date' });
  if (error) return dbFail('planForToday', error);
  revalidatePath('/home');
  return ok(undefined);
}

export async function clearPlanForToday(): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const today = todayFor(await getProfile(supabase, userId));
  const { error } = await supabase.from('planned_workouts').delete().eq('user_id', userId).eq('planned_date', today);
  if (error) return dbFail('clearPlan', error);
  revalidatePath('/home');
  return ok(undefined);
}

export async function saveTemplate(input: z.input<typeof templateSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await requireUser();
  const v = parsed.data;
  const { data, error } = await supabase.rpc('save_workout_template', {
    p_id: v.id,
    p_name: v.name,
    p_description: v.description,
    p_category: v.category,
    p_difficulty: v.difficulty,
    p_equipment: v.equipment,
    p_estimated_minutes: v.estimatedMinutes,
    p_items: v.items.map((i) => ({
      exercise_id: i.exerciseId,
      sets: i.sets,
      reps: i.measurementType === 'reps' || i.measurementType === 'weight_reps' ? i.reps : null,
      duration_seconds: i.measurementType === 'time' ? i.durationSeconds : null,
      distance_meters: i.measurementType === 'distance' ? i.distanceMeters : null,
      weight_kg: i.measurementType === 'weight_reps' ? i.weightKg : null,
      rest_seconds: i.restSeconds,
    })),
  });
  if (error) return dbFail('save_workout_template', error);
  revalidatePath('/workouts', 'layout');
  return ok({ id: data });
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return fail('That workout doesn’t exist.');
  const { supabase, userId } = await requireUser();
  // Past sessions keep their own copy of names and sets; their template link is cleared by the FK.
  const { error, count } = await supabase.from('workout_templates').delete({ count: 'exact' }).eq('id', id).eq('owner_id', userId);
  if (error) return dbFail('deleteTemplate', error);
  if (!count) return fail('Only your own workouts can be deleted.');
  revalidatePath('/', 'layout');
  return ok(undefined);
}

export async function createExercise(input: z.input<typeof customExerciseSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = customExerciseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, userId } = await requireUser();
  const v = parsed.data;
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      owner_id: userId,
      name: v.name,
      description: v.description,
      category: v.category,
      muscle_group: v.muscleGroup,
      equipment: v.equipment,
      difficulty: v.difficulty,
      measurement_type: v.measurementType,
      instructions: v.instructions,
    })
    .select('id')
    .single();
  if (error) return error.code === '23505' ? fail('You already have an exercise with that name.', { name: 'Name already used' }) : dbFail('createExercise', error);
  revalidatePath('/exercises');
  return ok({ id: data.id });
}

export async function deleteExercise(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return fail('That exercise doesn’t exist.');
  const { supabase, userId } = await requireUser();
  const { error, count } = await supabase.from('exercises').delete({ count: 'exact' }).eq('id', id).eq('owner_id', userId);
  if (error) return error.code === '23503' ? fail('This exercise is used in one of your workouts. Remove it there first.') : dbFail('deleteExercise', error);
  if (!count) return fail('Only your own exercises can be deleted.');
  revalidatePath('/exercises');
  return ok(undefined);
}
