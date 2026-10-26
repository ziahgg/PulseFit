import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { WorkoutBuilder } from '@/components/workout-builder';
import { appContext } from '@/lib/app-context';
import { getTemplate, listExercises } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Edit workout' };

export default async function EditWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, userId, profile } = await appContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, exercises] = await Promise.all([getTemplate(db, id), listExercises(db)]);
  // Only the owner can edit; system workouts are read-only.
  if (!data || data.template.owner_id !== userId) notFound();
  return <WorkoutBuilder exercises={exercises} units={profile.preferred_units} initial={data} />;
}
