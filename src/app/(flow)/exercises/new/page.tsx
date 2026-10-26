import type { Metadata } from 'next';

import { ExerciseForm } from '@/components/exercise-form';
import { appContext } from '@/lib/app-context';

export const metadata: Metadata = { title: 'New exercise' };

export default async function NewExercisePage() {
  await appContext();
  return <ExerciseForm />;
}
