import { Bookmark, Info, Search, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { FeaturedCard, WorkoutRowCard } from '@/components/cards';
import { SaveButton } from '@/components/save-button';
import { Screen } from '@/components/screen';
import { ButtonLink, Chip, EmptyState, IconButton, InfoNote, PageTitle, Tag } from '@/components/ui';
import { appContext } from '@/lib/app-context';
import { CATEGORY_LABEL } from '@/lib/domain/workouts';
import { requestTime } from '@/lib/request-time';
import { listSaved } from '@/lib/services/data';
import type { Category } from '@/types/database';

export const metadata: Metadata = { title: 'Saved' };

const DAY = 86_400_000;

/** Figma 09 Saved workouts (+ 09b empty, 09c removed-with-undo toast via SaveButton). */
export default async function SavedPage({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string; search?: string }> }) {
  const sp = await searchParams;
  const { db, userId } = await appContext();
  const all = await listSaved(db, userId);
  const cats = [...new Set(all.map((t) => t.category))] as Category[];
  const category = cats.includes(sp.cat as Category) ? (sp.cat as Category) : null;
  const q = (sp.q ?? '').trim().toLowerCase().slice(0, 60);
  const list = all.filter((t) => (!category || t.category === category) && (!q || t.name.toLowerCase().includes(q)));
  const minutes = all.reduce((s, t) => s + t.estimated_minutes, 0);
  const [first, ...rest] = list;
  const searching = !!sp.search || !!q;

  return (
    <Screen>
      <PageTitle title="Saved workouts" subtitle={`${all.length} workout${all.length === 1 ? '' : 's'} · ${minutes} min total`}>
        <IconButton icon={searching ? X : Search} label={searching ? 'Close search' : 'Search saved workouts'} href={searching ? '/saved' : '/saved?search=1'} className="size-14" />
      </PageTitle>
      {searching ? (
        <form action="/saved" role="search" className="flex h-14 items-center gap-3 rounded-full bg-surface px-5">
          <Search size={18} className="text-text-muted" aria-hidden />
          <label htmlFor="saved-q" className="sr-only">
            Search saved workouts
          </label>
          <input id="saved-q" name="q" type="search" defaultValue={q} autoFocus placeholder="Search saved" className="h-full flex-1 bg-transparent t-item outline-none" />
          <input type="hidden" name="search" value="1" />
        </form>
      ) : null}

      {!all.length ? (
        <EmptyState
          icon={Bookmark}
          title="No saved workouts yet"
          message="Tap the bookmark on any workout to keep it here for later."
          action={<ButtonLink href="/workouts" size="sm" className="mt-1">Browse workouts</ButtonLink>}
        />
      ) : (
        <>
          <nav aria-label="Category" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:px-0">
            <Chip selected={!category} href="/saved">
              All · {all.length}
            </Chip>
            {cats.map((c) => (
              <Chip key={c} selected={category === c} href={`/saved?cat=${c}`}>
                {CATEGORY_LABEL[c]}
              </Chip>
            ))}
          </nav>
          {first ? (
            <>
              <FeaturedCard
                t={first}
                href={`/workouts/${first.id}`}
                priority
                badge={requestTime() - Date.parse(first.saved_at) < DAY ? <Tag tone="brand">Just saved</Tag> : null}
                action={<SaveButton templateId={first.id} name={first.name} saved />}
              />
              <ul className="grid gap-3 md:grid-cols-2">
                {rest.map((t) => (
                  <li key={t.id}>
                    <WorkoutRowCard t={t} href={`/workouts/${t.id}`} trailing={<SaveButton templateId={t.id} name={t.name} saved look="plain" />} />
                  </li>
                ))}
              </ul>
              <InfoNote icon={Info}>Tap the bookmark again to remove a workout from Saved.</InfoNote>
            </>
          ) : (
            <p className="rounded-[20px] bg-surface p-5 t-body text-text-secondary">
              Nothing matches.{' '}
              <Link href="/saved" className="t-body-m underline underline-offset-4">
                Show all saved
              </Link>
            </p>
          )}
        </>
      )}
    </Screen>
  );
}
