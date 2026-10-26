import type { Metadata } from 'next';

import { GoalForm } from '@/components/goal-form';
import { appContext } from '@/lib/app-context';
import { weekRange } from '@/lib/domain/dates';
import { averagePerWeek } from '@/lib/domain/goals';
import { totalActiveMinutes } from '@/lib/domain/workouts';
import { listExercises, listGoals, listMeasurements, recentWorkouts } from '@/lib/services/data';
import type { GoalType } from '@/types/database';

export const metadata: Metadata = { title: 'New goal' };

const TYPES: GoalType[] = ['workout_frequency', 'active_minutes', 'habit', 'milestone', 'body_weight'];

export default async function NewGoalPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const { db, userId, today, profile } = await appContext();
  const [workouts, exercises, goals, weights] = await Promise.all([recentWorkouts(db, userId, today, 35), listExercises(db), listGoals(db, userId), listMeasurements(db, userId, 'weight')]);
  const taken = goals.filter((g) => g.status === 'active' && (g.goal_type === 'workout_frequency' || g.goal_type === 'active_minutes')).map((g) => g.goal_type);
  return (
    <GoalForm
      goal={null}
      initialType={TYPES.includes(type as GoalType) && !taken.includes(type as GoalType) ? (type as GoalType) : null}
      takenTypes={taken}
      exercises={exercises.map((e) => ({ id: e.id, name: e.name, measurement_type: e.measurement_type }))}
      hints={{ avgPerWeek: averagePerWeek(workouts, today), minutesThisWeek: totalActiveMinutes(workouts, weekRange(today)), latestWeightKg: weights[0] ? Number(weights[0].value) : null }}
      units={profile.preferred_units}
      today={today}
    />
  );
}
