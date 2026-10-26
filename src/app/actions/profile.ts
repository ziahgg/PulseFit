'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { dbFail, invalid, ok, type ActionResult } from '@/lib/action-result';
import { requireUser } from '@/lib/supabase/server';
import { onboardingSchema, preferencesSchema, profileSchema } from '@/lib/validations';

export async function completeOnboarding(input: z.input<typeof onboardingSchema>): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from('profiles').update({ focus_areas: parsed.data.focus, timezone: parsed.data.timezone, onboarded_at: new Date().toISOString() }).eq('id', userId);
  if (error) return dbFail('completeOnboarding', error);
  revalidatePath('/', 'layout');
  return ok(undefined);
}

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, userId } = await requireUser();
  const v = parsed.data;
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: v.displayName, experience_level: v.experienceLevel, preferred_units: v.preferredUnits, height_cm: v.heightCm, timezone: v.timezone })
    .eq('id', userId);
  if (error) return dbFail('updateProfile', error);
  revalidatePath('/', 'layout');
  return ok(undefined);
}

export async function updatePreferences(input: z.input<typeof preferencesSchema>): Promise<ActionResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, userId } = await requireUser();
  const v = parsed.data;
  const { error } = await supabase
    .from('profiles')
    .update({
      ...(v.remindersEnabled !== undefined && { reminders_enabled: v.remindersEnabled }),
      ...(v.reminderTime !== undefined && { reminder_time: v.reminderTime }),
      ...(v.preferredUnits !== undefined && { preferred_units: v.preferredUnits }),
      ...(v.focus !== undefined && { focus_areas: v.focus }),
      ...(v.experienceLevel !== undefined && { experience_level: v.experienceLevel }),
    })
    .eq('id', userId);
  if (error) return dbFail('updatePreferences', error);
  revalidatePath('/', 'layout');
  return ok(undefined);
}

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
  if (ids?.length) q = q.in('id', ids.filter((i) => z.guid().safeParse(i).success));
  const { error } = await q;
  if (error) return dbFail('markNotificationsRead', error);
  revalidatePath('/', 'layout');
  return ok(undefined);
}
