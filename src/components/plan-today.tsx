'use client';

import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';

import { clearPlanForToday, planForToday } from '@/app/actions/library';
import { CATEGORY_LABEL } from '@/lib/domain/workouts';
import type { TemplateCardData } from './cards';
import { Sheet } from './overlays';
import { useToast } from './toast';
import { Button, cx } from './ui';

/** "Change" on Home: pick which workout is planned for today, with an optional time. */
export function PlanTodayButton({ templates, currentId, label }: { templates: TemplateCardData[]; currentId: string | null; label: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(currentId);
  const [time, setTime] = useState('18:30');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const timeId = useId();

  const save = () =>
    start(async () => {
      const r = selected ? await planForToday(selected, time || null) : await clearPlanForToday();
      if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t update your plan', message: r.error });
      setOpen(false);
      toast({ title: selected ? 'Planned for today' : 'Plan cleared', message: templates.find((t) => t.id === selected)?.name });
      router.refresh();
    });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelected(currentId);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 t-body text-text-secondary hover:text-text"
        aria-haspopup="dialog"
      >
        {label}
        <ChevronRight size={16} aria-hidden />
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Plan for today"
        footer={
          <Button full onClick={save} loading={pending}>
            {selected ? 'Save plan' : 'Clear plan'}
          </Button>
        }
      >
        <div className="flex flex-col gap-1" role="radiogroup" aria-label="Workout">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected === t.id}
              onClick={() => setSelected(selected === t.id ? null : t.id)}
              className={cx('flex min-h-16 items-center gap-3 rounded-[18px] px-4 text-left', selected === t.id && 'bg-surface-muted')}
            >
              <span className="min-w-0 flex-1">
                <span className="t-item block truncate">{t.name}</span>
                <span className="t-caption text-text-muted">
                  {CATEGORY_LABEL[t.category]} · {t.estimated_minutes} min
                </span>
              </span>
              <span className={cx('size-6 shrink-0 rounded-full border-2', selected === t.id ? 'border-[7px] border-brand' : 'border-disabled')} aria-hidden />
            </button>
          ))}
        </div>
        <label htmlFor={timeId} className="mt-4 block t-label text-text-secondary">
          Time (optional)
        </label>
        <input id={timeId} type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1.5 h-12 w-full rounded-[16px] border border-border bg-surface px-4 t-item" />
      </Sheet>
    </>
  );
}
