import { CalendarSearch } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { SessionRow } from '@/components/cards';
import { PeriodButton } from '@/components/period-sheet';
import { Screen } from '@/components/screen';
import { Card, Chip, EmptyState, TopBar } from '@/components/ui';
import { appContext } from '@/lib/app-context';
import { addDays, rangeLabelShort, weekRange } from '@/lib/domain/dates';
import { resolvePeriod } from '@/lib/domain/periods';
import { CATEGORY_LABEL, formatClock, isFinished, totalActiveMinutes } from '@/lib/domain/workouts';
import { exerciseCounts, listWorkouts } from '@/lib/services/data';
import { CATEGORIES } from '@/lib/validations';
import type { Category, WorkoutRow } from '@/types/database';

export const metadata: Metadata = { title: 'Workout history' };

type Params = { cat?: string; period?: string; from?: string; to?: string };

/** Figma 07 Workout history (+ 07b empty filter). Grouped by week; shows the latest 200 sessions. */
export default async function HistoryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { db, userId, today } = await appContext();
  const category = (CATEGORIES as readonly string[]).includes(sp.cat ?? '') ? (sp.cat as Category) : null;
  const period = sp.period ? resolvePeriod(sp.period, today, sp.from, sp.to) : null;
  const workouts = (await listWorkouts(db, userId, { category, range: period?.range })).filter(isFinished);
  const counts = await exerciseCounts(db, workouts.map((w) => w.id));
  const completed = workouts.filter((w) => w.status === 'completed').length;

  const groups: { label: string; items: WorkoutRow[] }[] = [];
  const thisWeek = weekRange(today).start;
  for (const w of workouts) {
    const ws = weekRange(w.workout_date);
    const label = ws.start === thisWeek ? `This week · ${rangeLabelShort(ws)}` : ws.start === addDays(thisWeek, -7) ? `Last week · ${rangeLabelShort(ws)}` : rangeLabelShort(ws);
    const g = groups[groups.length - 1];
    if (g?.label === label) g.items.push(w);
    else groups.push({ label, items: [w] });
  }
  const q = (cat: string | null) => {
    const s = new URLSearchParams();
    if (cat) s.set('cat', cat);
    if (sp.period) s.set('period', sp.period);
    if (sp.from) s.set('from', sp.from);
    if (sp.to) s.set('to', sp.to);
    return `/history${s.size ? `?${s}` : ''}`;
  };

  return (
    <Screen>
      <TopBar title="Workout history" back="/activity" right={<PeriodButton current={period?.id ?? 'this_week'} today={today} look="surface" />} />
      <nav aria-label="Category" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
        <Chip selected={!category} href={q(null)}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={category === c} href={q(c)}>
            {CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </nav>
      {period ? (
        <p className="flex items-center justify-between rounded-[16px] bg-surface px-4 py-2.5 t-body">
          <span>
            {period.title} · {period.subtitle}
          </span>
          <Link href={q(category)} className="t-body-m underline underline-offset-4">
            Clear
          </Link>
        </p>
      ) : null}

      {workouts.length ? (
        <>
          <Card className="grid grid-cols-3 gap-2 p-5">
            <Stat label="Sessions" value={workouts.length} />
            <Stat label="Active min" value={totalActiveMinutes(workouts)} />
            <Stat label="Completed" value={`${completed} of ${workouts.length}`} right />
          </Card>
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label} className="flex flex-col gap-3">
              <h2 className="t-body text-text-secondary">{g.label}</h2>
              <ul className="flex flex-col gap-3">
                {g.items.map((w) => {
                  const c = counts.get(w.id) ?? { done: 0, total: 0 };
                  return (
                    <li key={w.id}>
                      <SessionRow date={w.workout_date} name={w.name} status={w.status} href={`/history/${w.id}`} meta={`${CATEGORY_LABEL[w.category]} · ${w.duration_seconds && w.duration_seconds % 60 ? formatClock(w.duration_seconds) : `${Math.round((w.duration_seconds ?? 0) / 60)} min`} · ${c.done}/${c.total} exercises`} />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      ) : (
        <EmptyState
          icon={CalendarSearch}
          title={category || period ? 'No sessions match' : 'No workouts yet'}
          message={category || period ? 'Try another workout type or period.' : 'Finished workouts appear here with their time and exercises.'}
          action={
            <Link href={category || period ? '/history' : '/workouts'} className="mt-1 inline-flex h-10 items-center rounded-full bg-ink px-4 t-button-s text-on-ink">
              {category || period ? 'Show all sessions' : 'Browse workouts'}
            </Link>
          }
        />
      )}
    </Screen>
  );
}

function Stat({ label, value, right }: { label: string; value: string | number; right?: boolean }) {
  return (
    <div className={right ? 'text-right' : undefined}>
      <p className="t-body text-text-muted">{label}</p>
      <p className="t-metric-m num">{value}</p>
    </div>
  );
}
