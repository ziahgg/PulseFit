'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';

import { updateProfile } from '@/app/actions/profile';
import { cmToIn, inToCm } from '@/lib/domain/units';
import type { FieldErrors } from '@/lib/validations';
import type { Difficulty, Units } from '@/types/database';
import { DIFFICULTY_LABEL } from './cards';
import { useToast } from './toast';
import { Button, Field, FormError, TopBar, cx } from './ui';

type Initial = { displayName: string; experienceLevel: Difficulty; preferredUnits: Units; heightCm: number | null; timezone: string };

export function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [pending, start] = useTransition();
  const [v, setV] = useState({ ...initial, height: initial.heightCm === null ? '' : String(initial.preferredUnits === 'metric' ? initial.heightCm : Math.round(cmToIn(initial.heightCm) * 10) / 10) });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [initial.timezone];

  const switchUnits = (u: Units) => {
    if (u === v.preferredUnits) return;
    const h = Number(v.height);
    const height = v.height && h ? String(Math.round((u === 'metric' ? inToCm(h) : cmToIn(h)) * 10) / 10) : v.height;
    setV({ ...v, preferredUnits: u, height });
  };

  const save = () =>
    start(async () => {
      const h = v.height.trim() ? Number(v.height) : null;
      const heightCm = h === null || Number.isNaN(h) ? null : Math.round((v.preferredUnits === 'metric' ? h : inToCm(h)) * 10) / 10;
      if (v.height.trim() && (h === null || Number.isNaN(h))) return setErrors({ heightCm: 'Enter a number' });
      const r = await updateProfile({ displayName: v.displayName, experienceLevel: v.experienceLevel, preferredUnits: v.preferredUnits, heightCm, timezone: v.timezone });
      if (!r.ok) {
        setErrors(r.fields ?? {});
        setFormError(r.fields ? undefined : r.error);
        return;
      }
      toast({ title: 'Profile updated' });
      router.replace('/profile');
      router.refresh();
    });

  const seg = <T extends string>(value: T, options: [T, string][], onChange: (t: T) => void, label: string) => (
    <div className="flex flex-col gap-1.5">
      <span className="t-label text-text-secondary">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-2">
        {options.map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)} className={cx('h-11 flex-1 rounded-full t-button-s', value === k ? 'bg-ink text-on-ink' : 'bg-surface')}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-5 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-32">
      <TopBar title="Edit profile" close="/profile" />
      <FormError message={formError} />
      <Field id={`${id}-name`} label="Name" value={v.displayName} maxLength={60} onChange={(e) => setV({ ...v, displayName: e.target.value })} error={errors.displayName} autoComplete="name" />
      {seg(v.experienceLevel, (['beginner', 'intermediate', 'advanced'] as Difficulty[]).map((d) => [d, DIFFICULTY_LABEL[d]]), (d) => setV({ ...v, experienceLevel: d }), 'Experience level')}
      {seg<Units>(v.preferredUnits, [['metric', 'Metric (kg, cm)'], ['imperial', 'Imperial (lb, in)']], switchUnits, 'Units')}
      <Field id={`${id}-height`} label={`Height (${v.preferredUnits === 'metric' ? 'cm' : 'in'}, optional)`} inputMode="decimal" value={v.height} onChange={(e) => setV({ ...v, height: e.target.value.replace(/[^\d.]/g, '').slice(0, 5) })} error={errors.heightCm} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-tz`} className="t-label text-text-secondary">
          Timezone (sets your local day and week)
        </label>
        <select id={`${id}-tz`} value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} className="h-14 rounded-[18px] border border-border bg-surface px-4 t-item">
          {[...new Set([v.timezone, ...zones])].map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </div>
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-bg from-70% to-transparent px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[520px]">
          <Button full loading={pending} onClick={save}>
            Save profile
          </Button>
        </div>
      </div>
    </main>
  );
}
