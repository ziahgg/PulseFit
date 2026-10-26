/**
 * Goal progress, always derived from source records (never stored):
 *  - workout_frequency: finished sessions this week vs target per week.
 *  - active_minutes:    active minutes this week vs target minutes per week.
 *  - habit:             finished sessions this week in the chosen categories.
 *  - milestone:         best completed set for the chosen exercise (seconds held, reps or kg).
 *  - body_weight:       latest weight vs target; progress measured from the first weigh-in on/after the start date.
 */
import type { Category, ExerciseSetRow, GoalRow, GoalType, GoalUnit, MeasurementRow, WorkoutRow } from '@/types/database';
import { daysBetween, inRange, weekRange, type LocalDate } from './dates';
import { isFinished, totalActiveMinutes } from './workouts';

export interface GoalProgress {
  current: number;
  target: number;
  /** 0–1, clamped. */
  fraction: number;
  met: boolean;
  /** Human summary, e.g. "3 of 4 workouts". */
  label: string;
  overdue: boolean;
  /** No source records yet (e.g. no weigh-ins) — show an empty state, not 0%. */
  noData: boolean;
}

export interface GoalInputs {
  today: LocalDate;
  workouts: Pick<WorkoutRow, 'status' | 'duration_seconds' | 'workout_date' | 'category'>[];
  /** Completed sets of the milestone exercise with values. */
  milestoneSets?: Pick<ExerciseSetRow, 'completed' | 'reps' | 'weight_kg' | 'duration_seconds'>[];
  weights?: Pick<MeasurementRow, 'value' | 'measured_at'>[];
}

export const GOAL_META: Record<GoalType, { title: string; subtitle: string; icon: string; unit: GoalUnit; step: number; min: number; max: number; defaultTarget: number }> = {
  workout_frequency: { title: 'Workout frequency', subtitle: 'Sessions per week', icon: 'calendar', unit: 'sessions_per_week', step: 1, min: 1, max: 14, defaultTarget: 4 },
  active_minutes: { title: 'Active minutes', subtitle: 'Minutes per week', icon: 'timer', unit: 'minutes_per_week', step: 10, min: 10, max: 1200, defaultTarget: 150 },
  habit: { title: 'Habit', subtitle: 'e.g. stretch 2× a week', icon: 'person-standing', unit: 'sessions_per_week', step: 1, min: 1, max: 14, defaultTarget: 2 },
  milestone: { title: 'Personal milestone', subtitle: 'e.g. hold a 60-sec plank', icon: 'trophy', unit: 'seconds', step: 5, min: 1, max: 3600, defaultTarget: 60 },
  body_weight: { title: 'Body weight', subtitle: 'Reach a target weight', icon: 'scale', unit: 'kg', step: 0.5, min: 20, max: 400, defaultTarget: 70 },
};

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function goalProgress(goal: Pick<GoalRow, 'goal_type' | 'target_value' | 'unit' | 'habit_categories' | 'start_date' | 'target_date' | 'status'>, input: GoalInputs): GoalProgress {
  const target = Number(goal.target_value);
  const week = weekRange(input.today);
  const overdue = goal.status === 'active' && !!goal.target_date && input.today > goal.target_date;
  const base = { target, overdue, noData: false };

  switch (goal.goal_type) {
    case 'workout_frequency': {
      const current = input.workouts.filter((w) => isFinished(w) && inRange(w.workout_date, week)).length;
      return { ...base, current, fraction: clamp(current / target), met: current >= target, label: `${current} of ${target} workouts` };
    }
    case 'active_minutes': {
      const current = totalActiveMinutes(input.workouts, week);
      return { ...base, current, fraction: clamp(current / target), met: current >= target, label: `${current} of ${target} min` };
    }
    case 'habit': {
      const cats = new Set<Category>(goal.habit_categories);
      const current = input.workouts.filter((w) => isFinished(w) && inRange(w.workout_date, week) && cats.has(w.category)).length;
      return { ...base, current, fraction: clamp(current / target), met: current >= target, label: `${current} of ${target} sessions this week` };
    }
    case 'milestone': {
      const sets = (input.milestoneSets ?? []).filter((s) => s.completed);
      const pick = (s: (typeof sets)[number]) => (goal.unit === 'seconds' ? s.duration_seconds : goal.unit === 'kg' ? s.weight_kg : s.reps) ?? 0;
      const best = sets.reduce((m, s) => Math.max(m, Number(pick(s))), 0);
      const unit = goal.unit === 'seconds' ? 'sec' : goal.unit === 'kg' ? 'kg' : 'reps';
      return { ...base, current: best, fraction: clamp(best / target), met: best >= target, label: sets.length ? `Best ${best} of ${target} ${unit}` : 'No attempts yet', noData: !sets.length };
    }
    case 'body_weight': {
      const ws = [...(input.weights ?? [])].sort((a, b) => a.measured_at.localeCompare(b.measured_at));
      if (!ws.length) return { ...base, current: 0, fraction: 0, met: false, label: 'Log a weigh-in to start tracking', noData: true };
      const fromStart = ws.filter((w) => w.measured_at.slice(0, 10) >= goal.start_date);
      const first = Number((fromStart[0] ?? ws[ws.length - 1]).value);
      const latest = Number(ws[ws.length - 1].value);
      const totalChange = target - first;
      const done = latest - first;
      const fraction = totalChange === 0 ? 1 : clamp(done / totalChange);
      const met = totalChange <= 0 ? latest <= target : latest >= target;
      return { ...base, current: latest, fraction, met, label: `${latest} kg now · target ${target} kg` };
    }
  }
}

/** Average finished sessions per week over the last `weeks` full weeks (for the "You averaged…" hint). */
export function averagePerWeek(workouts: Pick<WorkoutRow, 'status' | 'workout_date'>[], today: LocalDate, weeks = 4): number {
  const end = weekRange(today).start; // exclude the current, partial week
  const n = workouts.filter((w) => isFinished(w) && w.workout_date < end && daysBetween(w.workout_date, end) <= weeks * 7).length;
  return Math.round((n / weeks) * 10) / 10;
}
