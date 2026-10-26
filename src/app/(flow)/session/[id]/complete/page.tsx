import { Activity, Flame, ListChecks, Timer, Trophy, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { EffortPicker } from '@/components/effort-picker';
import { ShareButton } from '@/components/share-button';
import { ButtonLink, Card, Ring, StatCard } from '@/components/ui';
import { appContext } from '@/lib/app-context';
import { dayLabel, inRange, weekRange } from '@/lib/domain/dates';
import { goalProgress } from '@/lib/domain/goals';
import { activeMinutes, energyEstimate, exerciseProgress, formatClock, isFinished, weekStreak } from '@/lib/domain/workouts';
import { getSession, listGoals, listMeasurements, recentWorkouts } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Workout complete' };

const ASSUMED_KG = 70;

/** Figma 05 Workout complete. */
export default async function CompletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, userId, today } = await appContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await getSession(db, id);
  if (!session) notFound();
  if (session.status === 'in_progress') redirect(`/session/${id}`);
  const [workouts, goals, weights] = await Promise.all([recentWorkouts(db, userId, today, 400), listGoals(db, userId), listMeasurements(db, userId, 'weight')]);

  const secs = session.duration_seconds ?? 0;
  const ex = exerciseProgress(session.exercises);
  const bodyKg = weights[0] ? Number(weights[0].value) : null;
  const [lo, hi] = energyEstimate(session.category, secs, bodyKg ?? ASSUMED_KG);
  const freq = goals.find((g) => g.goal_type === 'workout_frequency' && g.status === 'active');
  const p = freq ? goalProgress(freq, { today, workouts }) : null;
  const streak = freq ? weekStreak(workouts, today, Number(freq.target_value)) : 0;
  const weekCount = workouts.filter((w) => isFinished(w) && inRange(w.workout_date, weekRange(today))).length;
  const partial = session.status === 'ended_early';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-5 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-36">
      <header className="flex items-center justify-between">
        <Link href="/home" aria-label="Close" className="grid size-14 place-items-center rounded-full border border-border bg-surface">
          <X size={22} aria-hidden />
        </Link>
        <ShareButton text={`${partial ? 'Partial session' : 'Workout complete'}: ${session.name} — ${formatClock(secs)}, ${ex.done}/${ex.total} exercises. Logged with PulseFit.`} />
      </header>

      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-[150px] place-items-center rounded-full border-[14px] border-brand bg-surface-muted">
          <span className="grid size-24 place-items-center rounded-full bg-ink text-on-ink">
            <Trophy size={40} aria-hidden />
          </span>
        </span>
        <h1 className="t-title-xl">{partial ? 'Session saved' : 'Workout complete!'}</h1>
        <p className="t-body text-text-secondary">
          {session.name} · {dayLabel(session.workout_date)}
          {partial ? ' · ended early' : ''}
        </p>
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard dark icon={Timer} label="Duration" value={formatClock(secs)} />
          <StatCard icon={ListChecks} label="Exercises" value={`${ex.done} / ${ex.total}`} className="bg-surface-muted" />
          <StatCard icon={Activity} label="Active minutes" value={`${activeMinutes(secs)} min`} className="bg-surface-muted" />
          <StatCard icon={Flame} label="Est. energy*" value={hi < 10 ? '< 10 kcal' : `${lo}–${hi} kcal`} className="bg-surface-muted" />
        </div>
        <p className="t-caption text-text-muted">
          *Rough estimate based on duration and intensity{bodyKg ? '' : `, assuming ${ASSUMED_KG} kg body weight`} — not a measurement.
        </p>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="t-card-title">How did it feel?</h2>
        <EffortPicker workoutId={session.id} value={session.effort} />
      </Card>

      <Card className="flex items-center gap-4 p-4">
        <Ring value={p?.fraction ?? 0} size={72} stroke={9} track="var(--surface-muted)" label={p ? p.label : `${weekCount} workouts this week`}>
          <span className="t-body-m num">{p ? `${p.current}/${p.target}` : weekCount}</span>
        </Ring>
        <div className="min-w-0">
          <p className="t-card-title">{p ? `${p.current} of ${p.target} workouts this week` : `${weekCount} workout${weekCount === 1 ? '' : 's'} this week`}</p>
          <p className="t-body text-text-secondary">
            {!p ? (
              <Link href="/goals/new?type=workout_frequency" className="underline underline-offset-4">
                Set a weekly goal
              </Link>
            ) : p.met ? (
              streak > 1 ? `Weekly goal reached — ${streak}-week streak!` : 'Weekly goal reached!'
            ) : (
              `${p.target - p.current} more ${p.target - p.current === 1 ? 'keeps' : 'keep'} your week on track.`
            )}
          </p>
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-bg from-70% to-transparent px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[520px] gap-3">
          <ButtonLink href={`/history/${session.id}`} variant="secondary" className="px-7">
            History
          </ButtonLink>
          <ButtonLink href="/home" full>
            Back to Home
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
