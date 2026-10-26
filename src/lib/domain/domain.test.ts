import { describe, expect, it } from 'vitest';

import { fieldErrors, goalSchema, measurementSchema, setValuesSchema, templateSchema, validateSetForType } from '@/lib/validations';
import type { Category, GoalType, GoalUnit } from '@/types/database';
import { addDays, isoWeekday, lastMonthsRange, localDate, monthRange, monthSpanLabel, rangeLabel, weekRange } from './dates';
import { averagePerWeek, goalProgress } from './goals';
import { displayWeight, formatDistance, kgToLb, lbToKg, toKg } from './units';
import { activeMinutes, currentExerciseIndex, dailyBars, elapsedSeconds, energyEstimate, exerciseProgress, formatClock, prescription, totalActiveMinutes, volumeKg, weekStreak } from './workouts';

const TODAY = '2026-10-29'; // Thursday
type Status = 'completed' | 'ended_early' | 'in_progress';
const w = (date: string, secs: number, status: Status = 'completed', category: Category = 'yoga') => ({
  workout_date: date,
  duration_seconds: status === 'in_progress' ? null : secs,
  status,
  category,
});

describe('dates', () => {
  it('uses Monday-start weeks and local calendar days', () => {
    expect(weekRange(TODAY)).toEqual({ start: '2026-10-26', end: '2026-11-01' });
    expect(isoWeekday('2026-11-01')).toBe(7);
    expect(rangeLabel(weekRange(TODAY))).toBe('Oct 26 – Nov 1, 2026');
    expect(rangeLabel({ start: '2026-12-28', end: '2027-01-03' })).toBe('Dec 28, 2026 – Jan 3, 2027');
    // 23:30 UTC on Oct 28 is already Oct 29 in Jakarta, still Oct 28 in New York.
    expect(localDate('2026-10-28T23:30:00Z', 'Asia/Jakarta')).toBe('2026-10-29');
    expect(localDate('2026-10-28T23:30:00Z', 'America/New_York')).toBe('2026-10-28');
    expect(localDate('2026-10-28T23:30:00Z', 'Not/AZone')).toBe('2026-10-28');
  });

  it('builds month and multi-month ranges', () => {
    expect(monthRange('2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(lastMonthsRange('2026-10-29', 3)).toEqual({ start: '2026-08-01', end: '2026-10-31' });
    expect(monthSpanLabel(lastMonthsRange('2026-10-29', 3))).toBe('Aug – Oct 2026');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('workout calculations', () => {
  it('formats clocks and rounds active minutes', () => {
    expect(formatClock(1540)).toBe('25:40');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(activeMinutes(1540)).toBe(26);
  });

  it('counts only finished sessions toward active minutes', () => {
    const ws = [w('2026-10-26', 36 * 60), w('2026-10-27', 15 * 60), w('2026-10-29', 1540), w('2026-10-29', 600, 'in_progress'), w('2026-10-20', 14 * 60, 'ended_early')];
    expect(totalActiveMinutes(ws, weekRange(TODAY))).toBe(77);
    expect(totalActiveMinutes(ws)).toBe(91);
  });

  it('classifies daily bars: 20+ active, under 20 light, future planned', () => {
    const ws = [w('2026-10-26', 36 * 60), w('2026-10-27', 15 * 60), w('2026-10-29', 1540)];
    const bars = dailyBars(ws, weekRange(TODAY), TODAY, (d) => d === '2026-10-31');
    expect(bars.map((b) => `${b.kind}:${b.minutes}`)).toEqual(['active:36', 'light:15', 'none:0', 'active:26', 'future:0', 'planned:0', 'future:0']);
  });

  it('computes week streaks against the weekly goal', () => {
    const ws = [
      ...['2026-10-05', '2026-10-06', '2026-10-07'].map((d) => w(d, 900)),
      ...['2026-10-12', '2026-10-13', '2026-10-14'].map((d) => w(d, 900)),
      ...['2026-10-19', '2026-10-20', '2026-10-22'].map((d) => w(d, 900)),
      w('2026-10-26', 900),
    ];
    expect(weekStreak(ws, TODAY, 3)).toBe(3); // this week not met yet → counts back from last week
    expect(weekStreak([...ws, w('2026-10-27', 900), w('2026-10-28', 900)], TODAY, 3)).toBe(4);
    expect(weekStreak(ws, TODAY, 4)).toBe(0);
  });

  it('derives elapsed time from server timestamps, excluding pauses', () => {
    const now = new Date('2026-10-29T12:10:00Z');
    expect(elapsedSeconds({ started_at: '2026-10-29T12:00:00Z', ended_at: null, paused_at: null, paused_seconds: 60, duration_seconds: null }, now)).toBe(540);
    expect(elapsedSeconds({ started_at: '2026-10-29T12:00:00Z', ended_at: null, paused_at: '2026-10-29T12:05:00Z', paused_seconds: 0, duration_seconds: null }, now)).toBe(300);
    expect(elapsedSeconds({ started_at: '2026-10-29T12:00:00Z', ended_at: '2026-10-29T12:30:00Z', paused_at: null, paused_seconds: 0, duration_seconds: 1540 }, now)).toBe(1540);
  });

  it('tracks exercise progress, volume and prescriptions', () => {
    const ex = [{ sets: [{ completed: true }, { completed: true }] }, { sets: [{ completed: true }, { completed: false }] }, { sets: [{ completed: false }] }];
    expect(exerciseProgress(ex)).toEqual({ done: 1, total: 3 });
    expect(currentExerciseIndex(ex)).toBe(1);
    expect(currentExerciseIndex([{ sets: [{ completed: true }] }])).toBe(0);
    expect(volumeKg([{ completed: true, reps: 10, weight_kg: 12 }, { completed: true, reps: 8, weight_kg: 12.5 }, { completed: false, reps: 10, weight_kg: 12 }])).toBe(220);
    expect(prescription('time', 3, { duration_seconds: 30 })).toBe('3 × 30 s');
    expect(prescription('weight_reps', 3, { reps: 10, weight_kg: 12 })).toBe('3 × 10 · 12 kg');
  });

  it('labels energy as a range, scaled by duration and body weight', () => {
    expect(energyEstimate('yoga', 1540, 70)).toEqual([70, 90]); // 2.5–3.0 MET × 70 kg × 0.43 h ≈ 75–90 kcal
    expect(energyEstimate('cardio', 3600, 80)).toEqual([320, 480]);
  });
});

describe('goal progress', () => {
  const ws = [w('2026-10-26', 36 * 60, 'completed', 'strength'), w('2026-10-27', 15 * 60, 'completed', 'mobility'), w('2026-10-29', 1540)];
  const goal = (goal_type: GoalType, target_value: number, unit: GoalUnit, extra: { habit_categories?: Category[]; target_date?: string } = {}) => ({
    goal_type,
    target_value,
    unit,
    habit_categories: [] as Category[],
    start_date: '2026-10-01',
    target_date: null as string | null,
    status: 'active' as const,
    ...extra,
  });

  it('measures weekly frequency, minutes and habits from this week’s sessions', () => {
    expect(goalProgress(goal('workout_frequency', 4, 'sessions_per_week'), { today: TODAY, workouts: ws })).toMatchObject({ current: 3, fraction: 0.75, met: false, label: '3 of 4 workouts' });
    expect(goalProgress(goal('active_minutes', 150, 'minutes_per_week'), { today: TODAY, workouts: ws })).toMatchObject({ current: 77, label: '77 of 150 min' });
    expect(goalProgress(goal('habit', 2, 'sessions_per_week', { habit_categories: ['mobility', 'yoga'] }), { today: TODAY, workouts: ws })).toMatchObject({ current: 2, met: true });
  });

  it('uses the best completed set for milestones and reports missing data', () => {
    const g = goal('milestone', 60, 'seconds');
    const sets = [
      { completed: true, duration_seconds: 45, reps: null, weight_kg: null },
      { completed: false, duration_seconds: 70, reps: null, weight_kg: null },
    ];
    expect(goalProgress(g, { today: TODAY, workouts: [], milestoneSets: sets })).toMatchObject({ current: 45, fraction: 0.75, met: false });
    expect(goalProgress(g, { today: TODAY, workouts: [] })).toMatchObject({ noData: true, label: 'No attempts yet' });
  });

  it('tracks weight targets from the first weigh-in and flags overdue goals', () => {
    const weights = [
      { value: 80, measured_at: '2026-10-02T08:00:00Z' },
      { value: 77, measured_at: '2026-10-28T08:00:00Z' },
    ];
    expect(goalProgress(goal('body_weight', 74, 'kg'), { today: TODAY, workouts: [], weights })).toMatchObject({ current: 77, fraction: 0.5, met: false });
    expect(goalProgress(goal('body_weight', 76, 'kg', { target_date: '2026-10-15' }), { today: TODAY, workouts: [], weights })).toMatchObject({ met: false, overdue: true });
    expect(goalProgress(goal('body_weight', 78, 'kg'), { today: TODAY, workouts: [], weights })).toMatchObject({ met: true });
    expect(goalProgress(goal('body_weight', 76, 'kg'), { today: TODAY, workouts: [], weights: [] })).toMatchObject({ noData: true });
  });

  it('averages full weeks only', () => {
    const hist = ['2026-10-05', '2026-10-07', '2026-10-13', '2026-10-15', '2026-10-17', '2026-10-20', '2026-10-22', '2026-10-24', '2026-10-27'].map((d) => w(d, 600));
    expect(averagePerWeek(hist, TODAY, 4)).toBe(2);
  });
});

describe('units', () => {
  it('converts weight and distance both ways', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 2);
    expect(lbToKg(220.462)).toBeCloseTo(100, 2);
    expect(displayWeight(70, 'imperial')).toBe(154.3);
    expect(toKg(154.3, 'imperial')).toBe(69.99);
    expect(formatDistance(5000, 'metric')).toBe('5 km');
    expect(formatDistance(5000, 'imperial')).toBe('3.11 mi');
  });
});

describe('validation', () => {
  it('rejects bad goals, mismatched units and out-of-range measurements', () => {
    const base = { id: null, title: 'x', habitCategories: [], exerciseId: null, preferredDays: [], reminderEnabled: false, targetDate: null };
    const r1 = goalSchema.safeParse({ ...base, goalType: 'active_minutes', targetValue: 150, unit: 'kg' });
    expect(r1.success).toBe(false);
    if (!r1.success) expect(fieldErrors(r1.error).unit).toMatch(/doesn’t fit/);
    expect(goalSchema.safeParse({ ...base, goalType: 'habit', targetValue: 2, unit: 'sessions_per_week' }).success).toBe(false);
    expect(goalSchema.safeParse({ ...base, goalType: 'workout_frequency', targetValue: 4.5, unit: 'sessions_per_week' }).success).toBe(false);
    expect(goalSchema.safeParse({ ...base, goalType: 'workout_frequency', targetValue: 4, unit: 'sessions_per_week' }).success).toBe(true);
    expect(measurementSchema.safeParse({ id: null, measurementType: 'weight', value: 5, measuredAt: '2026-10-29', notes: '' }).success).toBe(false);
    expect(measurementSchema.safeParse({ id: null, measurementType: 'weight', value: 70.4, measuredAt: '2026-02-30', notes: '' }).success).toBe(false);
  });

  it('requires the right set values for each exercise type', () => {
    const v = setValuesSchema.parse({ setId: '11111111-1111-4111-8111-111111111111', reps: null, weightKg: null, durationSeconds: 30, distanceMeters: null, completed: true });
    expect(validateSetForType('time', v)).toBeNull();
    expect(validateSetForType('weight_reps', v)).toMatch(/reps and weight/);
    expect(setValuesSchema.safeParse({ ...v, reps: -1 }).success).toBe(false);
  });

  it('requires exercises and per-type targets in custom workouts', () => {
    const base = { id: null, name: 'Mine', description: '', category: 'core', difficulty: 'beginner', equipment: 'mat', estimatedMinutes: 10 };
    expect(templateSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    const item = { exerciseId: '11111111-1111-4111-8111-111111111111', measurementType: 'time', sets: 3, reps: null, durationSeconds: null, distanceMeters: null, weightKg: null, restSeconds: 30 };
    expect(templateSchema.safeParse({ ...base, items: [item] }).success).toBe(false);
    expect(templateSchema.safeParse({ ...base, items: [{ ...item, durationSeconds: 30 }] }).success).toBe(true);
  });
});

describe('report periods', () => {
  it('resolves the Figma period options and clamps custom ranges', async () => {
    const { resolvePeriod, weeksIn } = await import('./periods');
    expect(resolvePeriod('this_week', TODAY)).toMatchObject({ range: { start: '2026-10-26', end: '2026-11-01' }, subtitle: 'Oct 26 – Nov 1, 2026', bars: 'days' });
    expect(resolvePeriod('last_week', TODAY)).toMatchObject({ range: { start: '2026-10-19', end: '2026-10-25' }, subtitle: 'Oct 19 – Oct 25' });
    expect(resolvePeriod('month', TODAY).subtitle).toBe('October 2026');
    expect(resolvePeriod('three_months', TODAY).subtitle).toBe('Aug – Oct 2026');
    expect(resolvePeriod('custom', TODAY, '2026-10-30', '2026-10-01').id).toBe('this_week'); // reversed → fallback
    expect(resolvePeriod('custom', TODAY, '2025-01-01', '2026-10-01').range.end).toBe('2026-01-02');
    expect(resolvePeriod('nonsense', TODAY).id).toBe('this_week');
    expect(weeksIn({ start: '2026-10-01', end: '2026-10-31' })).toHaveLength(5);
    expect(weeksIn({ start: '2026-10-01', end: '2026-10-31' })[0]).toEqual({ start: '2026-10-01', end: '2026-10-04' });
  });
});

describe('ids', () => {
  it('accepts the deterministic catalog ids (md5-based, not RFC-versioned)', () => {
    const catalogId = '744dd66f-c4b4-3cd6-bbc3-b0c21d453348';
    const item = { exerciseId: catalogId, measurementType: 'time', sets: 3, reps: null, durationSeconds: 30, distanceMeters: null, weightKg: null, restSeconds: 30 };
    const r = templateSchema.safeParse({ id: null, name: 'Mine', description: '', category: 'core', difficulty: 'beginner', equipment: 'mat', estimatedMinutes: 10, items: [item] });
    expect(r.success).toBe(true);
  });
});
