import { Plus, Target } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Screen } from '@/components/screen';
import { ButtonLink, EmptyState, IconButton, ProgressBar, Tag, TopBar } from '@/components/ui';
import { appContext } from '@/lib/app-context';
import { GOAL_META, goalProgress } from '@/lib/domain/goals';
import { shortDate } from '@/lib/domain/dates';
import { listGoals, listMeasurements, recentWorkouts, setsForExercise } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Fitness goals' };

export default async function GoalsPage() {
  const { db, userId, today } = await appContext();
  const [goals, workouts, weights] = await Promise.all([listGoals(db, userId, true), recentWorkouts(db, userId, today, 14), listMeasurements(db, userId, 'weight')]);
  const milestoneSets = new Map(await Promise.all(goals.filter((g) => g.goal_type === 'milestone' && g.exercise_id).map(async (g) => [g.id, await setsForExercise(db, g.exercise_id as string)] as const)));
  const active = goals.filter((g) => g.status === 'active');
  const done = goals.filter((g) => g.status !== 'active');

  const card = (g: (typeof goals)[number]) => {
    const p = goalProgress(g, { today, workouts, milestoneSets: milestoneSets.get(g.id), weights });
    return (
      <li key={g.id}>
        <Link href={`/goals/${g.id}`} className="flex flex-col gap-3 rounded-[24px] bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="t-label text-brand">{GOAL_META[g.goal_type].title}</p>
              <h3 className="t-card-title truncate">{g.title}</h3>
            </div>
            {g.status === 'completed' ? <Tag tone="success">Completed</Tag> : g.status === 'archived' ? <Tag>Archived</Tag> : p.overdue ? <Tag tone="warning">Overdue</Tag> : p.met ? <Tag tone="success">On track</Tag> : null}
          </div>
          {p.noData ? null : <ProgressBar value={p.fraction} label={`${g.title} progress`} />}
          <div className="flex justify-between gap-3 t-body text-text-muted">
            <span>{p.label}</span>
            {g.target_date ? <span>by {shortDate(g.target_date)}</span> : null}
          </div>
        </Link>
      </li>
    );
  };

  return (
    <Screen>
      <TopBar title="Fitness goals" back="/profile" right={<IconButton icon={Plus} label="New goal" look="ink" href="/goals/new" />} />
      {active.length ? <ul className="flex flex-col gap-3">{active.map(card)}</ul> : <EmptyState icon={Target} title="No active goals" message="Pick something measurable — a weekly routine, active minutes, a habit or a personal best." action={<ButtonLink href="/goals/new" size="sm">Create goal</ButtonLink>} />}
      {done.length ? (
        <section aria-labelledby="past-h" className="flex flex-col gap-3">
          <h2 id="past-h" className="t-section">
            Past goals
          </h2>
          <ul className="flex flex-col gap-3">{done.map(card)}</ul>
        </section>
      ) : null}
    </Screen>
  );
}
