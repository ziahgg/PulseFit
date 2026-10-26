import { Bookmark, ChevronRight, Dumbbell, Plus, Search, SearchX, SlidersHorizontal } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DIFFICULTY_LABEL, FeaturedCard, WorkoutRowCard } from '@/components/cards';
import { SaveButton } from '@/components/save-button';
import { Screen } from '@/components/screen';
import { Chip, EmptyState, IconButton, PageTitle, SectionHeader, Tag } from '@/components/ui';
import { appContext } from '@/lib/app-context';
import { CATEGORY_LABEL } from '@/lib/domain/workouts';
import { listTemplates, savedTemplateIds } from '@/lib/services/data';
import { CATEGORIES, DIFFICULTIES } from '@/lib/validations';
import type { Category, Difficulty } from '@/types/database';

export const metadata: Metadata = { title: 'Workouts' };

const DURATIONS = { any: [undefined, undefined], short: [undefined, 14], mid: [15, 30], long: [31, undefined] } as const;
const DURATION_LABEL: Record<keyof typeof DURATIONS, string> = { any: 'Any', short: '< 15 min', mid: '15–30', long: '30+' };
type Params = { q?: string; cat?: string; dur?: string; level?: string; filters?: string };

export default async function WorkoutsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const { db, userId, profile } = await appContext();
  const category = (CATEGORIES as readonly string[]).includes(p.cat ?? '') ? (p.cat as Category) : null;
  const dur = (p.dur && p.dur in DURATIONS ? p.dur : 'any') as keyof typeof DURATIONS;
  const level = (DIFFICULTIES as readonly string[]).includes(p.level ?? '') ? (p.level as Difficulty) : null;
  const q = (p.q ?? '').trim().slice(0, 60);
  const [min, max] = DURATIONS[dur];
  const [templates, saved] = await Promise.all([listTemplates(db, { category, q, minMinutes: min, maxMinutes: max }), savedTemplateIds(db, userId)]);

  const href = (patch: Partial<Params>) => {
    const next = { q: q || undefined, cat: category ?? undefined, dur: dur === 'any' ? undefined : dur, level: level ?? undefined, filters: p.filters, ...patch };
    const s = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => !!e[1]));
    return `/workouts${s.size ? `?${s}` : ''}`;
  };

  const filtered = level ? templates.filter((t) => t.difficulty === level) : templates;
  const featured = filtered.find((t) => t.is_popular) ?? filtered[0];
  const rest = filtered.filter((t) => t !== featured);
  const recommendedLevel = level ?? profile.experience_level;
  const nextLevel = DIFFICULTIES[(DIFFICULTIES.indexOf(recommendedLevel) + 1) % DIFFICULTIES.length];

  return (
    <Screen>
      <PageTitle title="Workouts">
        <IconButton icon={Bookmark} label="Saved workouts" href="/saved" className="size-14" />
      </PageTitle>

      <form action="/workouts" role="search" className="flex h-[60px] items-center gap-3 rounded-full bg-surface pr-2 pl-5">
        <Search size={20} className="shrink-0 text-text-muted" aria-hidden />
        <label htmlFor="q" className="sr-only">
          Search workouts
        </label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Search yoga, strength, stretch…" className="h-full min-w-0 flex-1 bg-transparent t-item outline-none placeholder:text-text-muted" />
        {category ? <input type="hidden" name="cat" value={category} /> : null}
        {dur !== 'any' ? <input type="hidden" name="dur" value={dur} /> : null}
        <Link href={href({ filters: p.filters ? undefined : '1' })} aria-label={p.filters ? 'Hide filters' : 'Show filters'} aria-expanded={!!p.filters} className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-on-ink">
          <SlidersHorizontal size={18} aria-hidden />
        </Link>
      </form>

      <nav aria-label="Category" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
        <Chip selected={!category} href={href({ cat: undefined })}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={category === c} href={href({ cat: c })}>
            {CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </nav>

      <div className="no-scrollbar -mx-5 flex items-center gap-2 overflow-x-auto px-5 lg:mx-0 lg:px-0" role="group" aria-label="Duration">
        <span className="t-body text-text-muted">Duration</span>
        {(Object.keys(DURATIONS) as (keyof typeof DURATIONS)[]).map((d) => (
          <Chip key={d} selected={dur === d} href={href({ dur: d === 'any' ? undefined : d })}>
            {DURATION_LABEL[d]}
          </Chip>
        ))}
      </div>

      {p.filters ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[20px] bg-surface p-3" role="group" aria-label="Level">
          <span className="px-1 t-body text-text-muted">Level</span>
          <Chip selected={!level} href={href({ level: undefined })}>
            Any
          </Chip>
          {DIFFICULTIES.map((d) => (
            <Chip key={d} selected={level === d} href={href({ level: d })}>
              {DIFFICULTY_LABEL[d]}
            </Chip>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Link href="/exercises" className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-4 t-button-s">
          <Dumbbell size={16} aria-hidden /> Exercise library
        </Link>
        <Link href="/workouts/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-4 t-button-s">
          <Plus size={16} aria-hidden /> Build a workout
        </Link>
      </div>

      {!featured ? (
        <EmptyState icon={SearchX} title="No workouts match" message="Try another search, category or duration." action={<Link href="/workouts" className="t-body-m underline underline-offset-4">Clear filters</Link>} />
      ) : (
        <>
          <section aria-labelledby="popular-h" className="flex flex-col gap-3">
            <h2 id="popular-h" className="t-section">
              {q || category || dur !== 'any' || level ? 'Top match' : 'Popular this week'}
            </h2>
            <FeaturedCard
              t={featured}
              href={`/workouts/${featured.id}`}
              priority
              badge={featured.is_popular ? <Tag tone="brand">Popular</Tag> : featured.owner_id ? <Tag tone="brand">Your workout</Tag> : null}
              action={<SaveButton templateId={featured.id} name={featured.name} saved={saved.has(featured.id)} />}
            />
          </section>
          {rest.length ? (
            <section aria-labelledby="rec-h" className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <SectionHeader id="rec-h" title={q || category ? 'More results' : 'Recommended for you'} />
                <Link href={href({ level: nextLevel, filters: '1' })} className="inline-flex items-center gap-1 t-body text-text-secondary" aria-label={`Level: ${DIFFICULTY_LABEL[recommendedLevel]}. Show ${DIFFICULTY_LABEL[nextLevel]}`}>
                  Level: {DIFFICULTY_LABEL[recommendedLevel]}
                  <ChevronRight size={16} aria-hidden />
                </Link>
              </div>
              <ul className="grid gap-3 md:grid-cols-2">
                {rest.map((t) => (
                  <li key={t.id}>
                    <WorkoutRowCard t={t} href={`/workouts/${t.id}`} trailing={<ChevronRight size={20} className="text-text-muted" aria-hidden />} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </Screen>
  );
}
