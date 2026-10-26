import { Bell, Check, ChevronLeft, ChevronRight, Flame, Play } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { FeaturedCard } from '@/components/cards';
import { PlanTodayButton } from '@/components/plan-today';
import { SaveButton } from '@/components/save-button';
import { Screen } from '@/components/screen';
import { ButtonLink, Card, IconButton, Ring, SectionHeader, Tag, cx } from '@/components/ui';
import { appContext } from '@/lib/app-context';
import { addDays, dayNumber, eachDay, inRange, isoWeekday, rangeLabel, weekRange, weekdayShort } from '@/lib/domain/dates';
import { goalProgress } from '@/lib/domain/goals';
import { isFinished, weekStreak } from '@/lib/domain/workouts';
import { activeWorkout, listGoals, listTemplates, plannedInRange, recentWorkouts, savedTemplateIds, unreadCount } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Home' };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'PF';

const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export default async function HomePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { db, userId, profile, today } = await appContext();
  const offset = Math.max(-52, Math.min(4, Number((await searchParams).week) || 0));
  const week = weekRange(addDays(today, offset * 7));
  const [workouts, goals, planned, active, unread, templates, saved] = await Promise.all([
    recentWorkouts(db, userId, today, 400),
    listGoals(db, userId),
    plannedInRange(db, userId, { start: week.start, end: weekRange(today).end > week.end ? weekRange(today).end : week.end }),
    activeWorkout(db, userId),
    unreadCount(db, userId),
    listTemplates(db),
    savedTemplateIds(db, userId),
  ]);

  const freq = goals.find((g) => g.goal_type === 'workout_frequency' && g.status === 'active');
  const target = freq ? Number(freq.target_value) : null;
  const progress = freq ? goalProgress(freq, { today, workouts }) : null;
  const streak = target ? weekStreak(workouts, today, target) : 0;
  const thisWeekDone = workouts.filter((w) => isFinished(w) && inRange(w.workout_date, weekRange(today))).length;

  const doneDays = new Set(workouts.filter(isFinished).map((w) => w.workout_date));
  const plannedDays = new Set(planned.map((p) => p.planned_date));
  const preferred = new Set(freq?.preferred_days ?? []);
  const todayPlan = planned.find((p) => p.planned_date === today);
  const todayTemplate = todayPlan ? templates.find((t) => t.id === todayPlan.template_id) : undefined;
  const lastSession = workouts.find(isFinished);

  return (
    <Screen>
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="t-body text-text-secondary">Welcome back</p>
          <h1 className="t-title-xl truncate">{profile.display_name || 'there'}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="relative">
            <IconButton icon={Bell} label={unread ? `Notifications, ${unread} unread` : 'Notifications'} href="/notifications" className="size-14" />
            {unread ? <span className="absolute top-3 right-3.5 size-2.5 rounded-full bg-brand ring-2 ring-surface" aria-hidden /> : null}
          </span>
          <Link href="/profile" aria-label="Profile" className="grid size-14 place-items-center rounded-full bg-ink t-section text-on-ink">
            {initials(profile.display_name)}
          </Link>
        </div>
      </header>

      {active ? (
        <Link href={`/session/${active.id}`} className="flex items-center gap-3 rounded-[24px] bg-brand p-4 text-on-brand">
          <span className="grid size-11 place-items-center rounded-full bg-white/20">
            <Play size={20} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="t-card-title block">Workout in progress</span>
            <span className="t-body block truncate opacity-85">{active.name} · tap to resume</span>
          </span>
          <ChevronRight size={20} aria-hidden />
        </Link>
      ) : null}

      <section aria-label="Weekly progress" className="flex items-center gap-4 rounded-[32px] bg-ink p-6 text-on-ink">
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] leading-[26px] font-semibold sm:t-title-l">Activity Weekly Progress</h2>
          {freq && progress ? (
            <>
              <p className="mt-4 flex items-center gap-2.5 t-body-m">
                <span className="grid size-8 place-items-center rounded-full bg-brand">
                  <Flame size={16} aria-hidden />
                </span>
                {streak ? `${streak}-week streak` : 'Start a streak this week'}
              </p>
              <p className="mt-3 t-body text-white/60">
                {progress.current} of {target} workouts · {progress.met ? 'goal reached' : `${Number(target) - progress.current} to go`}
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 t-body text-white/70">{thisWeekDone} workouts this week. Set a weekly goal to track streaks.</p>
              <Link href="/goals/new?type=workout_frequency" className="mt-4 inline-flex h-10 items-center rounded-full bg-brand px-4 t-button-s text-on-brand">
                Set weekly goal
              </Link>
            </>
          )}
        </div>
        <Ring value={progress?.fraction ?? 0} size={112} stroke={13} label={freq ? `${progress?.current} of ${target} workouts this week` : 'No weekly goal yet'}>
          <span className="t-metric-l num">{freq ? `${progress?.current}/${target}` : thisWeekDone}</span>
          <span className="t-caption text-white/70">workouts</span>
        </Ring>
      </section>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="t-title">{offset === 0 ? 'This week' : offset === -1 ? 'Last week' : 'Week'}</h2>
            <p className="t-body text-text-muted">{rangeLabel(week)}</p>
          </div>
          <div className="flex gap-2">
            <IconButton icon={ChevronLeft} label="Previous week" look="muted" href={`/home?week=${offset - 1}`} />
            <IconButton icon={ChevronRight} label="Next week" look="muted" href={`/home?week=${offset + 1}`} disabled={offset >= 4} />
          </div>
        </div>
        <ol className="mt-5 grid grid-cols-7 gap-1 text-center">
          {eachDay(week).map((d) => {
            const isToday = d === today;
            const done = doneDays.has(d);
            const plan = d >= today && (plannedDays.has(d) || preferred.has(isoWeekday(d)));
            const label = `${weekdayShort(d)} ${dayNumber(d)}: ${done ? 'workout done' : plan ? 'planned' : d < today ? 'rest day' : 'nothing planned'}`;
            return (
              <li key={d} aria-label={label} className={cx('flex flex-col items-center gap-2 rounded-full py-3', isToday && 'bg-ink text-on-ink')}>
                <span className={cx('t-label', isToday ? 'text-white/70' : 'text-text-muted')}>{weekdayShort(d)[0]}</span>
                <span className="t-section num">{dayNumber(d)}</span>
                <span className="grid h-7 place-items-center" aria-hidden>
                  {done ? (
                    <span className="grid size-6 place-items-center rounded-full bg-brand text-white">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  ) : isToday ? (
                    <span className="size-6 rounded-full border-2 border-dashed border-white/80" />
                  ) : plan ? (
                    <span className="size-2 rounded-full bg-disabled" />
                  ) : d < today ? (
                    <span className="t-body text-text-muted">–</span>
                  ) : (
                    <span className="size-2 rounded-full bg-divider" />
                  )}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 t-body text-text-secondary">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-brand" /> Workout done
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-disabled" /> Planned
          </span>
          <span className="flex items-center gap-2">– Rest day</span>
        </div>
      </Card>

      <section aria-labelledby="today-h" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="today-h" className="t-section">
            Planned for today
          </h2>
          <PlanTodayButton templates={templates.map((t) => ({ id: t.id, name: t.name, category: t.category, estimated_minutes: t.estimated_minutes, difficulty: t.difficulty, equipment: t.equipment, image_key: t.image_key }))} currentId={todayTemplate?.id ?? null} label={todayTemplate ? 'Change' : 'Plan one'} />
        </div>
        {todayTemplate ? (
          <FeaturedCard
            t={todayTemplate}
            href={`/workouts/${todayTemplate.id}`}
            priority
            badge={<Tag tone="brand" className="bg-brand-soft">{todayPlan?.planned_time ? `Today · ${fmtTime(todayPlan.planned_time)}` : 'Today'}</Tag>}
            action={<SaveButton templateId={todayTemplate.id} name={todayTemplate.name} saved={saved.has(todayTemplate.id)} />}
          />
        ) : (
          <Card className="flex flex-col items-start gap-3 p-5">
            <p className="t-body text-text-secondary">Nothing planned for today. Pick a workout, or browse the library.</p>
            <ButtonLink href="/workouts" size="sm" variant="secondary">
              Browse workouts
            </ButtonLink>
          </Card>
        )}
      </section>

      {lastSession ? (
        <section aria-labelledby="last-h" className="flex flex-col gap-3">
          <SectionHeader id="last-h" title="Last session" href="/history" linkLabel="History" />
          <Link href={`/history/${lastSession.id}`} className="flex items-center justify-between gap-3 rounded-[24px] bg-surface p-4">
            <span className="min-w-0">
              <span className="t-card-title block truncate">{lastSession.name}</span>
              <span className="t-body text-text-muted">
                {weekdayShort(lastSession.workout_date)}, {dayNumber(lastSession.workout_date)} · {Math.round((lastSession.duration_seconds ?? 0) / 60)} min
              </span>
            </span>
            <ChevronRight size={18} className="text-text-muted" aria-hidden />
          </Link>
        </section>
      ) : null}
    </Screen>
  );
}
