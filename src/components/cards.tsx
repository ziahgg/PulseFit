import { Clock, Gauge, PersonStanding } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { dayNumber, weekdayShort } from '@/lib/domain/dates';
import { CATEGORY_LABEL } from '@/lib/domain/workouts';
import type { Category, Difficulty, Equipment, WorkoutStatus } from '@/types/database';
import { Meta, MetaPill, Tag, cx } from './ui';

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
export const EQUIPMENT_LABEL: Record<Equipment, string> = { none: 'No equipment', mat: 'Mat', dumbbells: 'Dumbbells', kettlebell: 'Kettlebell', resistance_band: 'Band', bench: 'Bench' };

const IMAGES = new Set(['yoga', 'mobility', 'stretch', 'lunge', 'breathing', 'plank', 'core', 'cardio', 'strength', 'full-body']);
const CATEGORY_IMAGE: Record<Category, string> = { yoga: 'yoga', strength: 'strength', mobility: 'mobility', cardio: 'cardio', core: 'core', stretching: 'stretch', breathing: 'breathing' };

/** Local photo for an image key, falling back to the category's photo (custom workouts have no key). */
export function imageSrc(key: string | null | undefined, category: Category): string {
  return `/images/${key && IMAGES.has(key) ? key : CATEGORY_IMAGE[category]}.jpg`;
}

export interface TemplateCardData {
  id: string;
  name: string;
  category: Category;
  difficulty: Difficulty;
  equipment: Equipment;
  estimated_minutes: number;
  image_key: string | null;
}

/** Figma featured card: photo, gradient, badge, bookmark, title and meta pills. */
export function FeaturedCard({ t, badge, action, href, priority }: { t: TemplateCardData; badge?: ReactNode; action?: ReactNode; href: string; priority?: boolean }) {
  return (
    <article className="relative isolate h-[272px] overflow-hidden rounded-[32px] bg-ink text-white sm:h-[300px]">
      <Image src={imageSrc(t.image_key, t.category)} alt="" fill sizes="(min-width: 1024px) 720px, 100vw" priority={priority} className="photo -z-10 object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/20 to-black/5" aria-hidden />
      <Link href={href} className="absolute inset-0 z-0" aria-label={t.name} />
      <div className="pointer-events-none relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between">
          <div>{badge}</div>
          <div className="pointer-events-auto">{action}</div>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="t-title-l">{t.name}</h3>
          <div className="flex flex-wrap gap-2">
            <MetaPill icon={Clock}>{t.estimated_minutes} min</MetaPill>
            <MetaPill icon={Gauge}>{DIFFICULTY_LABEL[t.difficulty]}</MetaPill>
            {t.equipment !== 'none' ? <MetaPill icon={PersonStanding}>{EQUIPMENT_LABEL[t.equipment]}</MetaPill> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Figma list card: thumbnail, orange category, name, duration + level, trailing slot. */
export function WorkoutRowCard({ t, href, trailing }: { t: TemplateCardData; href: string; trailing?: ReactNode }) {
  return (
    <article className="relative flex items-center gap-4 rounded-[24px] bg-surface p-3 pr-4">
      <div className="relative size-[88px] shrink-0 overflow-hidden rounded-[18px] bg-surface-muted sm:size-[100px]">
        <Image src={imageSrc(t.image_key, t.category)} alt="" fill sizes="100px" className="photo object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="t-label text-brand">{CATEGORY_LABEL[t.category]}</p>
        <h3 className="t-card-title truncate">
          <Link href={href} className="after:absolute after:inset-0">
            {t.name}
          </Link>
        </h3>
        <div className="mt-1 flex gap-3 whitespace-nowrap">
          <Meta icon={Clock}>{t.estimated_minutes} min</Meta>
          <Meta icon={Gauge}>{DIFFICULTY_LABEL[t.difficulty]}</Meta>
        </div>
      </div>
      {trailing ? <div className="relative z-10 shrink-0">{trailing}</div> : null}
    </article>
  );
}

export const STATUS_TAG: Record<WorkoutStatus, { tone: 'success' | 'warning' | 'brand'; label: string }> = {
  completed: { tone: 'success', label: 'Done' },
  ended_early: { tone: 'warning', label: 'Ended early' },
  in_progress: { tone: 'brand', label: 'In progress' },
};

/** Figma session row: date tile, name, "Category · 25:40 · 8/8 exercises", status tag. */
export function SessionRow({ date, name, meta, status, href }: { date: string; name: string; meta: string; status: WorkoutStatus; href: string }) {
  const tag = STATUS_TAG[status];
  return (
    <Link href={href} className="flex items-center gap-4 rounded-[24px] bg-surface p-3 pr-4 hover:bg-white/70">
      <span className="flex size-16 shrink-0 flex-col items-center justify-center rounded-[16px] bg-surface-muted">
        <span className="t-label text-text-muted">{weekdayShort(date)}</span>
        <span className="t-metric-m num">{dayNumber(date)}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="t-card-title block truncate">{name}</span>
        <span className="t-body block truncate text-text-muted">{meta}</span>
      </span>
      <Tag tone={tag.tone} className={cx(status === 'completed' && 'px-3')}>
        {tag.label}
      </Tag>
    </Link>
  );
}
