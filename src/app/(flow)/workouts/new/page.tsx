import type { Metadata } from 'next';

import { WorkoutBuilder } from '@/components/workout-builder';
import { appContext } from '@/lib/app-context';
import { listExercises } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Build a workout' };

export default async function NewWorkoutPage() {
  const { db, profile } = await appContext();
  const exercises = await listExercises(db);
  return <WorkoutBuilder exercises={exercises} units={profile.preferred_units} initial={null} />;
}
