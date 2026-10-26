'use client';

import { Calendar, Check } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useId, useState } from 'react';

import { resolvePeriod, type PeriodId } from '@/lib/domain/periods';
import { Sheet } from './overlays';
import { Button, IconButton, cx } from './ui';

const OPTIONS: PeriodId[] = ['this_week', 'last_week', 'month', 'three_months', 'custom'];

/** Figma 06b "Select period" sheet; writes the choice to the URL so the server renders it. */
export function PeriodButton({ current, today, look = 'ink' }: { current: PeriodId; today: string; look?: 'ink' | 'surface' }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<PeriodId>(current);
  const [from, setFrom] = useState(params.get('from') ?? today);
  const [to, setTo] = useState(params.get('to') ?? today);
  const fromId = useId();
  const toId = useId();
  const invalid = sel === 'custom' && (!from || !to || from > to);

  const apply = () => {
    const q = new URLSearchParams(params.toString());
    q.set('period', sel);
    if (sel === 'custom') {
      q.set('from', from);
      q.set('to', to);
    } else {
      q.delete('from');
      q.delete('to');
    }
    setOpen(false);
    router.push(`${path}?${q}`);
  };

  const label = sel === 'custom' ? 'Show custom range' : `Show ${resolvePeriod(sel, today).title.toLowerCase()}`;

  return (
    <>
      <IconButton
        icon={Calendar}
        label="Select period"
        look={look}
        className="size-14"
        onClick={() => {
          setSel(current);
          setOpen(true);
        }}
      />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Select period"
        footer={
          <Button full onClick={apply} disabled={invalid}>
            {label}
          </Button>
        }
      >
        <div role="radiogroup" aria-label="Period" className="flex flex-col gap-1">
          {OPTIONS.map((o) => {
            const p = resolvePeriod(o, today);
            return (
              <button key={o} type="button" role="radio" aria-checked={sel === o} onClick={() => setSel(o)} className={cx('flex min-h-[68px] items-center gap-3 rounded-[20px] px-5 text-left', sel === o && 'bg-surface-muted')}>
                <span className="flex-1">
                  <span className="t-item block">{o === 'custom' ? 'Custom range' : p.title}</span>
                  <span className="t-body text-text-muted">{o === 'custom' ? 'Pick dates' : p.subtitle.replace(/, \d{4}$/, (m) => (o === 'this_week' ? '' : m))}</span>
                </span>
                <span className={cx('grid size-7 place-items-center rounded-full', sel === o ? 'bg-brand text-white' : 'border-2 border-disabled')} aria-hidden>
                  {sel === o ? <Check size={16} strokeWidth={3} /> : null}
                </span>
              </button>
            );
          })}
        </div>
        {sel === 'custom' ? (
          <div className="mt-3 grid grid-cols-2 gap-3 px-1">
            <label htmlFor={fromId} className="flex flex-col gap-1.5 t-label text-text-secondary">
              From
              <input id={fromId} type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className="h-12 rounded-[14px] border border-border bg-surface px-3 t-item text-text" />
            </label>
            <label htmlFor={toId} className="flex flex-col gap-1.5 t-label text-text-secondary">
              To
              <input id={toId} type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="h-12 rounded-[14px] border border-border bg-surface px-3 t-item text-text" />
            </label>
            {invalid ? <p className="col-span-2 t-label text-error">The start date must be on or before the end date.</p> : null}
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
