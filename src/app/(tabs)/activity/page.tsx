import { ChartNoAxesColumn, ChevronRight, Scale } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { SessionRow } from '@/components/cards';
import { ActivityBars, type Bar } from '@/components/charts';
import { PeriodButton } from '@/components/period-sheet';
import { Screen } from '@/components/screen';
import { Card, Chip, EmptyState, SectionHeader, Tag } from '@/components/ui';
import { appContext } from '@/lib/app-context';
import { addDays, inRange, isoWeekday, shortDate, weekRange, weekdayShort } from '@/lib/domain/dates';
import { goalProgress } from '@/lib/domain/goals';
import { resolvePeriod, weeksIn } from '@/lib/domain/periods';
import { displayWeight, weightLabel } from '@/lib/domain/units';
import { CATEGORY_LABEL, dailyBars, exerciseProgress, formatClock, isFinished, sessionCount, totalActiveMinutes } from '@/lib/domain/workouts';
import { exerciseCounts, listGoals, listMeasurements, listWorkouts, plannedInRange } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Activity' };

type Params = { period?: string; from?: string; to?: string };

/** Figma 06 Activity: period chips, active minutes bars, weekly goal, workouts, recent sessions. */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { db, userId, today, profile } = await appContext();
  const period = resolvePeriod(sp.period, today, sp.from, sp.to);
  const span = Math.max(1, Math.round((Date.parse(period.range.end) - Date.parse(period.range.start)) / 86_400_000) + 1);
  const prevRange = { start: addDays(period.range.start, -span), end: addDays(period.range.start, -1) };

  const [workouts, goals, planned, weights] = await Promise.all([
    listWorkouts(db, userId, { range: { start: prevRange.start < weekRange(today).start ? prevRange.start : addDays(weekRange(today).start, -7), end: period.range.end > today ? period.range.end : today }, limit: 1000 }),
    listGoals(db, userId),
    plannedInRange(db, userId, period.range),
    listMeasurements(db, userId, 'weight'),
  ]);
  const inPeriod = workouts.filter((w) => inRange(w.workout_date, period.range));
  const finished = inPeriod.filter(isFinished);
  const minutes = totalActiveMinutes(inPeriod);
  const prevMinutes = totalActiveMinutes(workouts, prevRange);
  const prevSessions = sessionCount(workouts, prevRange);

  const minutesGoal = goals.find((g) => g.goal_type === 'active_minutes' && g.status === 'active');
  const freq = goals.find((g) => g.goal_type === 'workout_frequency' && g.status === 'active');
  const preferred = new Set(freq?.preferred_days ?? []);
  const plannedDays = new Set(planned.map((p) => p.planned_date));
  const freqProgress = freq ? goalProgress(freq, { today, workouts }) : null;

  let bars: Bar[];
  if (period.bars === 'days') {
    bars = dailyBars(inPeriod, period.range, today, (d) => plannedDays.has(d) || preferred.has(isoWeekday(d))).map((b) => ({
      key: b.date,
      label: weekdayShort(b.date),
      value: b.minutes,
      kind: b.kind,
      highlight: b.date === today,
    }));
  } else {
    bars = weeksIn(period.range).map((w) => {
      const m = totalActiveMinutes(inPeriod, w);
      return { key: w.start, label: shortDate(w.start).replace(/^(\w{3}) /, '$1 '), value: m, kind: w.start > today ? 'future' : m >= 60 ? 'active' : m > 0 ? 'light' : 'none', highlight: inRange(today, w) };
    });
  }
  const counts = await exerciseCounts(db, finished.slice(0, 5).map((w) => w.id));
  const recentWeights = weights.slice(0, 2);

  const chip = (id: string, label: string) => (
    <Chip selected={period.id === id} href={`/activity?period=${id}`}>
      {label}
    </Chip>
  );

  return (
    <Screen>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="t-title-l sm:t-title-xl">Progress &amp; Statistics</h1>
          <p className="t-body text-text-muted">{period.subtitle}</p>
        </div>
        <PeriodButton current={period.id} today={today} />
      </header>
      <nav aria-label="Period" className="flex flex-wrap gap-2">
        {chip('this_week', 'This week')}
        {chip('last_week', 'Last week')}
        {chip('month', 'Month')}
        {period.id === 'three_months' || period.id === 'custom' ? (
          <Chip selected href={`/activity?period=${period.id}${period.id === 'custom' ? `&from=${period.range.start}&to=${period.range.end}` : ''}`}>
            {period.title}
          </Chip>
        ) : null}
      </nav>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="t-body text-text-secondary">Active minutes</p>
            <p className="t-metric-l num">{minutes} min</p>
          </div>
          {minutesGoal ? (
            <Link href={`/goals/${minutesGoal.id}`}>
              <Tag className="h-8 px-3 t-body-m">Target {Number(minutesGoal.target_value)} / week</Tag>
            </Link>
          ) : (
            <Link href="/goals/new?type=active_minutes" className="t-body-m text-brand">
              Set a target
            </Link>
          )}
        </div>
        <div className="mt-4">
          <ActivityBars bars={bars} summary={`${period.title}: ${bars.map((b) => `${b.label} ${b.value} minutes`).join(', ')}`} />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 t-body text-text-secondary">
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-ink" /> {period.bars === 'days' ? '20+ min' : '60+ min'}
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-inactive" /> {period.bars === 'days' ? 'Under 20 min' : 'Under 60 min'}
          </span>
          {period.bars === 'days' ? (
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-full border border-dashed border-disabled" /> Planned
            </span>
          ) : null}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Link href={freq ? `/goals/${freq.id}` : '/goals/new?type=workout_frequency'} className="flex flex-col gap-1 rounded-[24px] bg-surface p-5">
          <span className="flex items-center justify-between t-body text-text-secondary">
            Weekly goal <ChevronRight size={18} aria-hidden />
          </span>
          {freqProgress ? (
            <>
              <span className="t-metric-l num">{Math.round(freqProgress.fraction * 100)}%</span>
              <span className="t-body text-text-muted">{freqProgress.label}</span>
            </>
          ) : (
            <span className="t-body text-text-muted">Set a weekly workout goal</span>
          )}
        </Link>
        <div className="flex flex-col gap-1 rounded-[24px] bg-surface p-5">
          <span className="t-body text-text-secondary">Workouts</span>
          <span className="t-metric-l text-brand num">{finished.length}</span>
          <span className="t-body text-text-muted">
            Previous: {prevSessions} · {prevMinutes} min
          </span>
        </div>
      </div>

      <Link href="/measurements" className="flex items-center gap-4 rounded-[24px] bg-surface p-5">
        <span className="grid size-11 place-items-center rounded-full bg-surface-muted">
          <Scale size={20} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="t-card-title block">Body weight</span>
          <span className="t-body text-text-muted">
            {recentWeights[0]
              ? `${displayWeight(Number(recentWeights[0].value), profile.preferred_units)} ${weightLabel(profile.preferred_units)}${recentWeights[1] ? ` · ${(() => {
                  const d = displayWeight(Number(recentWeights[0].value) - Number(recentWeights[1].value), profile.preferred_units);
                  return `${d > 0 ? '+' : ''}${d} since last`;
                })()}` : ''}`
              : 'Log a weigh-in to see your trend'}
          </span>
        </span>
        <ChevronRight size={18} className="text-text-muted" aria-hidden />
      </Link>

      <section aria-labelledby="recent-h" className="flex flex-col gap-3">
        <SectionHeader id="recent-h" title="Recent sessions" href="/history" linkLabel="All history" />
        {finished.length ? (
          <ul className="flex flex-col gap-3">
            {finished.slice(0, 5).map((w) => {
              const c = counts.get(w.id) ?? exerciseProgress([]);
              return (
                <li key={w.id}>
                  <SessionRow date={w.workout_date} name={w.name} status={w.status} href={`/history/${w.id}`} meta={`${CATEGORY_LABEL[w.category]} · ${formatClock(w.duration_seconds ?? 0)} · ${c.done}/${c.total} exercises`} />
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={ChartNoAxesColumn} title="No sessions in this period" message="Finished workouts show up here with their time and exercises." />
        )}
      </section>
    </Screen>
  );
}
