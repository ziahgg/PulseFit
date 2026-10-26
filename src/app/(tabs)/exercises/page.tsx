import { ChevronRight, Plus, Search, SearchX } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { DIFFICULTY_LABEL, EQUIPMENT_LABEL, imageSrc } from '@/components/cards';
import { Screen } from '@/components/screen';
import { Chip, EmptyState, IconButton, Tag, TopBar } from '@/components/ui';
import { appContext } from '@/lib/app-context';
import { CATEGORY_LABEL } from '@/lib/domain/workouts';
import { listExercises } from '@/lib/services/data';
import { CATEGORIES } from '@/lib/validations';
import type { Category } from '@/types/database';

export const metadata: Metadata = { title: 'Exercise library' };

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const sp = await searchParams;
  const { db, userId } = await appContext();
  const category = (CATEGORIES as readonly string[]).includes(sp.cat ?? '') ? (sp.cat as Category) : null;
  const q = (sp.q ?? '').trim().slice(0, 60);
  const exercises = await listExercises(db, { category, q });
  const href = (cat: string | null) => `/exercises?${new URLSearchParams({ ...(q && { q }), ...(cat && { cat }) })}`;

  return (
    <Screen>
      <TopBar title="Exercise library" back="/workouts" right={<IconButton icon={Plus} label="New custom exercise" look="ink" href="/exercises/new" />} />
      <form action="/exercises" role="search" className="flex h-14 items-center gap-3 rounded-full bg-surface px-5">
        <Search size={18} className="text-text-muted" aria-hidden />
        <label htmlFor="ex-q" className="sr-only">
          Search exercises
        </label>
        <input id="ex-q" name="q" type="search" defaultValue={q} placeholder="Search exercises" className="h-full flex-1 bg-transparent t-item outline-none placeholder:text-text-muted" />
        {category ? <input type="hidden" name="cat" value={category} /> : null}
      </form>
      <nav aria-label="Category" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
        <Chip selected={!category} href={href(null)}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={category === c} href={href(c)}>
            {CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </nav>
      {exercises.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {exercises.map((e) => (
            <li key={e.id}>
              <Link href={`/exercises/${e.id}`} className="flex items-center gap-4 rounded-[24px] bg-surface p-3 pr-4">
                <span className="relative size-16 shrink-0 overflow-hidden rounded-[14px] bg-surface-muted">
                  <Image src={imageSrc(e.image_key, e.category)} alt="" fill sizes="64px" className="photo object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="t-card-title truncate">{e.name}</span>
                    {e.owner_id === userId ? <Tag tone="brand">Custom</Tag> : null}
                  </span>
                  <span className="t-body block truncate text-text-muted">
                    {CATEGORY_LABEL[e.category]} · {DIFFICULTY_LABEL[e.difficulty]} · {e.equipment === 'none' ? 'No equipment' : EQUIPMENT_LABEL[e.equipment]}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={SearchX} title="No exercises found" message="Try another search or category, or add your own exercise." />
      )}
      <p className="t-caption text-text-muted">The built-in catalog is PulseFit sample programming for general fitness, not medical or physiotherapy advice.</p>
    </Screen>
  );
}
