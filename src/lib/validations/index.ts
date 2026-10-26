/**
 * Input schemas shared by forms (client) and server actions (server).
 * Servers always re-validate; the database constraints are the final backstop.
 */
import { z } from 'zod';

import { isLocalDate, isValidTimeZone } from '@/lib/domain/dates';

export const CATEGORIES = ['yoga', 'strength', 'mobility', 'cardio', 'core', 'stretching', 'breathing'] as const;
export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export const EQUIPMENT = ['none', 'mat', 'dumbbells', 'kettlebell', 'resistance_band', 'bench'] as const;
export const MUSCLE_GROUPS = ['full_body', 'upper_body', 'lower_body', 'core', 'back', 'chest', 'shoulders', 'arms', 'legs', 'hips', 'cardio'] as const;
export const MEASUREMENT_TYPES = ['time', 'reps', 'weight_reps', 'distance'] as const;
export const FOCUS_AREAS = ['flexibility', 'strength', 'mobility', 'cardio', 'core', 'stress_relief'] as const;

const uuid = z.guid({ message: 'Invalid id' });
const localDate = z.string().refine(isLocalDate, 'Choose a valid date');
const trimmed = (max: number, label: string) => z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`);

// ───────────── Auth ─────────────

export const emailSchema = z.email({ message: 'Enter a valid email address' }).trim().toLowerCase();
export const passwordSchema = z.string().min(8, 'Use at least 8 characters').max(72, 'Use 72 characters or fewer');

export const signUpSchema = z.object({
  displayName: trimmed(60, 'Name'),
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password') });
export const forgotSchema = z.object({ email: emailSchema });
export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'Passwords don’t match', path: ['confirm'] });

// ───────────── Profile ─────────────

export const onboardingSchema = z.object({
  focus: z.array(z.enum(FOCUS_AREAS)).max(3, 'Pick up to 3'),
  timezone: z.string().refine(isValidTimeZone, 'Unknown timezone'),
});

export const profileSchema = z.object({
  displayName: trimmed(60, 'Name'),
  experienceLevel: z.enum(DIFFICULTIES),
  preferredUnits: z.enum(['metric', 'imperial']),
  heightCm: z.number().min(50, 'Height looks too small').max(272, 'Height looks too large').nullable(),
  timezone: z.string().refine(isValidTimeZone, 'Unknown timezone'),
});

export const preferencesSchema = z.object({
  remindersEnabled: z.boolean().optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM').optional(),
  preferredUnits: z.enum(['metric', 'imperial']).optional(),
  focus: z.array(z.enum(FOCUS_AREAS)).max(3).optional(),
  experienceLevel: z.enum(DIFFICULTIES).optional(),
});

// ───────────── Sessions & sets ─────────────

/** Values recorded for one set. Which fields are required depends on the exercise's measurement type. */
export const setValuesSchema = z.object({
  setId: uuid,
  reps: z.number().int().min(0).max(500).nullable(),
  weightKg: z.number().min(0).max(1000).nullable(),
  durationSeconds: z.number().int().min(0).max(7200).nullable(),
  distanceMeters: z.number().min(0).max(1_000_000).nullable(),
  completed: z.boolean(),
});

export function validateSetForType(type: (typeof MEASUREMENT_TYPES)[number], v: z.infer<typeof setValuesSchema>): string | null {
  if (!v.completed) return null;
  if (type === 'reps' && !v.reps) return 'Enter the reps you did';
  if (type === 'weight_reps' && (!v.reps || v.weightKg === null)) return 'Enter reps and weight';
  if (type === 'time' && !v.durationSeconds) return 'Enter how long you held it';
  if (type === 'distance' && !v.distanceMeters) return 'Enter the distance';
  return null;
}

export const finishSchema = z.object({
  workoutId: uuid,
  status: z.enum(['completed', 'ended_early']),
  effort: z.enum(['easy', 'just_right', 'hard']).nullable(),
});

export const sessionEditSchema = z.object({
  workoutId: uuid,
  notes: z.string().trim().max(500, 'Keep notes under 500 characters'),
  effort: z.enum(['easy', 'just_right', 'hard']).nullable(),
  durationMinutes: z.number().int().min(1, 'Duration must be at least 1 minute').max(1440),
});

// ───────────── Custom workouts & exercises ─────────────

export const templateItemSchema = z
  .object({
    exerciseId: uuid,
    measurementType: z.enum(MEASUREMENT_TYPES),
    sets: z.number().int().min(1, 'At least 1 set').max(20, 'At most 20 sets'),
    reps: z.number().int().min(1).max(500).nullable(),
    durationSeconds: z.number().int().min(1).max(7200).nullable(),
    distanceMeters: z.number().positive().max(1_000_000).nullable(),
    weightKg: z.number().min(0).max(1000).nullable(),
    restSeconds: z.number().int().min(0).max(600),
  })
  .superRefine((v, ctx) => {
    const need = (ok: boolean, msg: string) => ok || ctx.addIssue({ code: 'custom', message: msg });
    if (v.measurementType === 'time') need(!!v.durationSeconds, 'Set a duration');
    if (v.measurementType === 'reps' || v.measurementType === 'weight_reps') need(!!v.reps, 'Set the reps');
    if (v.measurementType === 'distance') need(!!v.distanceMeters, 'Set a distance');
  });

export const templateSchema = z.object({
  id: uuid.nullable(),
  name: trimmed(80, 'Name'),
  description: z.string().trim().max(600),
  category: z.enum(CATEGORIES),
  difficulty: z.enum(DIFFICULTIES),
  equipment: z.enum(EQUIPMENT),
  estimatedMinutes: z.number().int().min(1, 'At least 1 minute').max(240, 'At most 240 minutes'),
  items: z.array(templateItemSchema).min(1, 'Add at least one exercise').max(30, 'Up to 30 exercises'),
});

export const customExerciseSchema = z.object({
  name: trimmed(80, 'Name'),
  description: z.string().trim().max(500),
  category: z.enum(CATEGORIES),
  muscleGroup: z.enum(MUSCLE_GROUPS),
  equipment: z.enum(EQUIPMENT),
  difficulty: z.enum(DIFFICULTIES),
  measurementType: z.enum(MEASUREMENT_TYPES),
  instructions: z.array(z.string().trim().min(1).max(200)).max(10),
});

// ───────────── Goals ─────────────

export const goalSchema = z
  .object({
    id: uuid.nullable(),
    goalType: z.enum(['workout_frequency', 'active_minutes', 'habit', 'milestone', 'body_weight']),
    title: trimmed(80, 'Title'),
    targetValue: z.number().positive('Target must be greater than zero').max(10000),
    unit: z.enum(['sessions_per_week', 'minutes_per_week', 'seconds', 'reps', 'kg']),
    habitCategories: z.array(z.enum(CATEGORIES)).max(7),
    exerciseId: uuid.nullable(),
    preferredDays: z.array(z.number().int().min(1).max(7)).max(7),
    reminderEnabled: z.boolean(),
    targetDate: localDate.nullable(),
  })
  .superRefine((v, ctx) => {
    const units: Record<string, string[]> = {
      workout_frequency: ['sessions_per_week'],
      active_minutes: ['minutes_per_week'],
      habit: ['sessions_per_week'],
      milestone: ['seconds', 'reps', 'kg'],
      body_weight: ['kg'],
    };
    if (!units[v.goalType].includes(v.unit)) ctx.addIssue({ code: 'custom', path: ['unit'], message: 'That unit doesn’t fit this goal' });
    if (v.goalType === 'habit' && !v.habitCategories.length) ctx.addIssue({ code: 'custom', path: ['habitCategories'], message: 'Pick at least one workout type' });
    if (v.goalType === 'milestone' && !v.exerciseId) ctx.addIssue({ code: 'custom', path: ['exerciseId'], message: 'Choose an exercise' });
    if ((v.goalType === 'workout_frequency' || v.goalType === 'habit') && (!Number.isInteger(v.targetValue) || v.targetValue > 14))
      ctx.addIssue({ code: 'custom', path: ['targetValue'], message: 'Use a whole number from 1 to 14' });
  });

// ───────────── Measurements ─────────────

export const measurementSchema = z
  .object({
    id: uuid.nullable(),
    measurementType: z.enum(['weight', 'body_fat', 'waist', 'chest', 'hips']),
    /** Already converted to canonical units (kg / cm / percent). */
    value: z.number().positive('Enter a value'),
    measuredAt: localDate,
    notes: z.string().trim().max(200),
  })
  .superRefine((v, ctx) => {
    const [lo, hi] = v.measurementType === 'weight' ? [20, 400] : v.measurementType === 'body_fat' ? [2, 75] : [30, 250];
    if (v.value < lo || v.value > hi) ctx.addIssue({ code: 'custom', path: ['value'], message: `Enter a value between ${lo} and ${hi}` });
  });

export type FieldErrors = Record<string, string>;

/** Flattens Zod issues to { field: firstMessage } for inline form errors. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : 'form';
    out[key] ??= issue.message;
  }
  return out;
}
