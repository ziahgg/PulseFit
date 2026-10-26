import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { DIFFICULTY_LABEL, EQUIPMENT_LABEL, imageSrc } from '@/components/cards';
import { DeleteExerciseButton } from '@/components/exercise-actions';
import { Screen } from '@/components/screen';
import { Card, Tag, TopBar } from '@/components/ui';
import { appContext } from '@/lib/app-context';
import { formatWeight } from '@/lib/domain/units';
import { CATEGORY_LABEL } from '@/lib/domain/workouts';
import { getExercise, setsForExercise } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Exercise' };

const MUSCLE: Record<string, string> = { full_body: 'Full body', upper_body: 'Upper body', lower_body: 'Lower body', core: 'Core', back: 'Back', chest: 'Chest', shoulders: 'Shoulders', arms: 'Arms', legs: 'Legs', hips: 'Hips', cardio: 'Cardio' };

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, userId, profile } = await appContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [e, sets] = await Promise.all([getExercise(db, id), setsForExercise(db, id)]);
  if (!e) notFound();
  const best =
    e.measurement_type === 'time'
      ? Math.max(0, ...sets.map((s) => s.duration_seconds ?? 0))
      : e.measurement_type === 'weight_reps'
        ? Math.max(0, ...sets.map((s) => Number(s.weight_kg ?? 0)))
        : Math.max(0, ...sets.map((s) => s.reps ?? 0));
  const bestLabel = !sets.length ? null : e.measurement_type === 'time' ? `${best} sec hold` : e.measurement_type === 'weight_reps' ? formatWeight(best, profile.preferred_units) : `${best} reps`;

  return (
    <Screen>
      <TopBar title={e.name} back="/exercises" />
      <div className="relative h-[220px] overflow-hidden rounded-[28px] bg-surface-muted">
        <Image src={imageSrc(e.image_key, e.category)} alt="" fill priority sizes="(min-width: 1024px) 720px, 100vw" className="photo object-cover" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Tag tone="brand">{CATEGORY_LABEL[e.category]}</Tag>
        <Tag>{DIFFICULTY_LABEL[e.difficulty]}</Tag>
        <Tag>{MUSCLE[e.muscle_group]}</Tag>
        <Tag>{e.equipment === 'none' ? 'No equipment' : EQUIPMENT_LABEL[e.equipment]}</Tag>
        {e.owner_id ? <Tag tone="brand">Custom</Tag> : null}
      </div>
      {e.description ? <p className="t-body text-text-secondary">{e.description}</p> : null}
      {e.instructions.length ? (
        <Card className="p-5">
          <h2 className="t-section">How to do it</h2>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 t-body text-text-secondary">
            {e.instructions.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ol>
        </Card>
      ) : null}
      <Card className="flex items-center justify-between gap-3 p-5">
        <div>
          <h2 className="t-section">Your history</h2>
          <p className="t-body text-text-muted">{sets.length ? `${sets.length} completed set${sets.length === 1 ? '' : 's'}` : 'Not done yet'}</p>
        </div>
        {bestLabel ? (
          <div className="text-right">
            <p className="t-label text-text-muted">Personal best</p>
            <p className="t-metric-m num">{bestLabel}</p>
          </div>
        ) : null}
      </Card>
      {e.owner_id === userId ? <DeleteExerciseButton id={e.id} name={e.name} /> : null}
    </Screen>
  );
}
