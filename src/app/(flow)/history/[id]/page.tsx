import { CircleCheck, CircleDashed, Gauge, ListChecks, Timer } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { imageSrc } from '@/components/cards';
import { EFFORT_LABEL } from '@/components/effort-picker';
import { Screen } from '@/components/screen';
import { SessionActions } from '@/components/session-actions';
import { ShareButton } from '@/components/share-button';
import { Card, StatCard, Tag, TopBar } from '@/components/ui';
import { appContext } from '@/lib/app-context';
import { dayLabel, localTime } from '@/lib/domain/dates';
import { formatDistance, formatWeight } from '@/lib/domain/units';
import { exerciseDone, exerciseProgress, formatClock, volumeKg } from '@/lib/domain/workouts';
import { getSession } from '@/lib/services/data';
import type { ExerciseSetRow, MeasurementType, Units } from '@/types/database';

export const metadata: Metadata = { title: 'Session details' };

function setSummary(type: MeasurementType, sets: ExerciseSetRow[], units: Units): string {
  const done = sets.filter((s) => s.completed);
  if (!done.length) return 'Skipped';
  if (type === 'time') return done.map((s) => `${s.duration_seconds ?? 0}s`).join(' · ');
  if (type === 'distance') return done.map((s) => formatDistance(Number(s.distance_meters ?? 0), units)).join(' · ');
  if (type === 'weight_reps') return `${done.map((s) => `${s.reps ?? 0}×${formatWeight(Number(s.weight_kg ?? 0), units)}`).join(' · ')} · ${formatWeight(volumeKg(done), units)} volume`;
  return done.map((s) => `${s.reps ?? 0} reps`).join(' · ');
}

/** Figma 07c Session details, with edit (notes, effort, duration) and delete. */
export default async function SessionDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, profile } = await appContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = await getSession(db, id);
  if (!s || s.status === 'in_progress') notFound();
  const ex = exerciseProgress(s.exercises);
  const tz = profile.timezone;
  const secs = s.duration_seconds ?? 0;

  return (
    <Screen>
      <TopBar title="Session details" back="/history" right={<ShareButton text={`${s.name} — ${formatClock(secs)}, ${ex.done}/${ex.total} exercises. Logged with PulseFit.`} />} />
      <div className="relative h-[220px] overflow-hidden rounded-[28px]">
        <Image src={imageSrc(s.image_key, s.category)} alt="" fill priority sizes="(min-width: 1024px) 720px, 100vw" className="photo object-cover" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="t-title-l">{s.name}</h1>
          {s.status === 'ended_early' ? <Tag tone="warning">Ended early</Tag> : null}
        </div>
        <p className="t-body text-text-secondary">
          {dayLabel(s.workout_date)} · {localTime(s.started_at, tz)}
          {s.ended_at ? ` – ${localTime(s.ended_at, tz)}` : ''}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard dark icon={Timer} label="Duration" value={formatClock(secs)} />
        <StatCard icon={ListChecks} label="Exercises" value={`${ex.done} / ${ex.total}`} />
        <StatCard icon={Gauge} label="Effort" value={s.effort ? EFFORT_LABEL[s.effort] : '—'} />
      </div>
      {s.notes ? <Card className="p-4 t-body text-text-secondary">{s.notes}</Card> : null}
      <section aria-labelledby="ex-h" className="flex flex-col gap-3">
        <h2 id="ex-h" className="t-section">
          Exercises {s.status === 'ended_early' ? 'recorded' : 'completed'}
        </h2>
        <ol className="flex flex-col gap-3">
          {s.exercises.map((e, i) => {
            const done = exerciseDone(e.sets);
            return (
              <li key={e.id} className="flex items-center gap-4 rounded-[24px] bg-surface p-3 pr-4">
                <span className="relative size-[72px] shrink-0 overflow-hidden rounded-[16px] bg-surface-muted">
                  <Image src={imageSrc(e.image_key, s.category)} alt="" fill sizes="72px" className="photo object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="t-card-title block truncate">{e.exercise_name_snapshot}</span>
                  <span className="t-body block truncate text-text-muted">{setSummary(e.measurement_type, e.sets, profile.preferred_units)}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="t-body text-text-muted num">
                    {String(i + 1).padStart(2, '0')}/{String(s.exercises.length).padStart(2, '0')}
                  </span>
                  {done ? <CircleCheck size={22} className="text-success" aria-label="Completed" /> : <CircleDashed size={22} className="text-text-muted" aria-label="Not completed" />}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
      <SessionActions workoutId={s.id} name={s.name} notes={s.notes} effort={s.effort} minutes={Math.max(1, Math.round(secs / 60))} />
    </Screen>
  );
}
