import { ArrowLeft, Clock, Gauge, Layers, Pencil, Target } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DIFFICULTY_LABEL, EQUIPMENT_LABEL, imageSrc } from '@/components/cards';
import { SaveButton } from '@/components/save-button';
import { Screen } from '@/components/screen';
import { StartWorkoutButton } from '@/components/start-workout';
import { IconButton, StatCard, Tag } from '@/components/ui';
import { appContext } from '@/lib/app-context';
import { CATEGORY_LABEL, prescription } from '@/lib/domain/workouts';
import { activeWorkout, getTemplate, plannedInRange, savedTemplateIds } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Workout' };

export default async function WorkoutDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, userId, today } = await appContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, saved, planned, active] = await Promise.all([getTemplate(db, id), savedTemplateIds(db, userId), plannedInRange(db, userId, { start: today, end: today }), activeWorkout(db, userId)]);
  if (!data) notFound();
  const { template: t, items } = data;
  const isPlanned = planned.some((p) => p.template_id === t.id);
  const totalSets = items.reduce((s, i) => s + i.sets, 0);

  return (
    <Screen
      className="!px-0 !pt-0"
      footer={
        <>
          <SaveButton templateId={t.id} name={t.name} saved={saved.has(t.id)} look="surface" />
          <StartWorkoutButton templateId={t.id} activeId={active?.id ?? null} activeName={active?.name ?? null} disabled={!items.length} />
        </>
      }
    >
      <div className="relative h-[360px] overflow-hidden lg:mx-10 lg:mt-10 lg:rounded-[32px]">
        <Image src={imageSrc(t.image_key, t.category)} alt="" fill priority sizes="(min-width: 1024px) 720px, 100vw" className="photo object-cover" />
        <div className="absolute inset-x-5 top-[max(20px,env(safe-area-inset-top))] flex justify-between">
          <Link href="/workouts" aria-label="Back" className="grid size-14 place-items-center rounded-full bg-white/85 backdrop-blur">
            <ArrowLeft size={22} aria-hidden />
          </Link>
          {t.owner_id === userId ? <IconButton icon={Pencil} label="Edit workout" look="glass" href={`/workouts/${t.id}/edit`} className="size-14" /> : null}
        </div>
      </div>
      <section className="relative -mt-10 flex flex-col gap-5 rounded-t-[32px] bg-bg px-5 pt-6 lg:mx-10 lg:mt-6 lg:rounded-none lg:px-0">
        <div className="flex flex-wrap gap-2">
          <Tag tone="brand">{CATEGORY_LABEL[t.category]}</Tag>
          {isPlanned ? <Tag>Planned for today</Tag> : null}
          {t.owner_id ? <Tag>Custom</Tag> : null}
        </div>
        <h1 className="t-title-xl">{t.name}</h1>
        {t.description ? <p className="t-body text-text-secondary">{t.description}</p> : null}
        <div className="grid grid-cols-3 gap-3">
          <StatCard dark icon={Clock} label="Duration" value={`${t.estimated_minutes} min`} />
          <StatCard icon={Gauge} label="Level" value={DIFFICULTY_LABEL[t.difficulty]} />
          <StatCard icon={Layers} label="Equipment" value={t.equipment === 'none' ? 'None' : EQUIPMENT_LABEL[t.equipment]} />
        </div>
        {t.focus.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="t-body text-text-muted">Focus</span>
            {t.focus.map((f) => (
              <span key={f} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-muted px-3 t-body-m text-text-secondary">
                <Target size={14} aria-hidden />
                {f}
              </span>
            ))}
          </div>
        ) : null}
        <section aria-labelledby="ex-h" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 id="ex-h" className="t-section">
              Exercises · {items.length}
            </h2>
            <span className="t-body text-text-muted">{totalSets} sets total</span>
          </div>
          <ol className="flex flex-col gap-2">
            {items.map((it, i) => (
              <li key={it.id}>
                <Link href={`/exercises/${it.exercise.id}`} className="flex items-center gap-4 rounded-[20px] bg-surface p-3 pr-4">
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-[14px] bg-surface-muted">
                    <Image src={imageSrc(it.exercise.image_key, it.exercise.category)} alt="" fill sizes="64px" className="photo object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="t-card-title block truncate">{it.exercise.name}</span>
                    <span className="t-body block truncate text-text-muted">{it.cue || it.exercise.description}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="t-caption block text-text-muted num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="t-body-m num">{prescription(it.exercise.measurement_type, it.sets, it)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </section>
    </Screen>
  );
}
