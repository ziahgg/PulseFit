import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { GoalForm } from '@/components/goal-form';
import { appContext } from '@/lib/app-context';
import { weekRange } from '@/lib/domain/dates';
import { averagePerWeek } from '@/lib/domain/goals';
import { totalActiveMinutes } from '@/lib/domain/workouts';
import { getGoal, listExercises, listMeasurements, recentWorkouts } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Edit goal' };

export default async function EditGoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, userId, today, profile } = await appContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [goal, workouts, exercises, weights] = await Promise.all([getGoal(db, id), recentWorkouts(db, userId, today, 35), listExercises(db), listMeasurements(db, userId, 'weight')]);
  if (!goal) notFound();
  return (
    <GoalForm
      goal={goal}
      initialType={goal.goal_type}
      takenTypes={[]}
      exercises={exercises.map((e) => ({ id: e.id, name: e.name, measurement_type: e.measurement_type }))}
      hints={{ avgPerWeek: averagePerWeek(workouts, today), minutesThisWeek: totalActiveMinutes(workouts, weekRange(today)), latestWeightKg: weights[0] ? Number(weights[0].value) : null }}
      units={profile.preferred_units}
      today={today}
    />
  );
}
