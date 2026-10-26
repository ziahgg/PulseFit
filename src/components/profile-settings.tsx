'use client';

import { Bell, BellRing, Gauge, History, KeyRound, LogOut, Ruler, Scale, Target, Dumbbell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { signOut } from '@/app/actions/auth';
import { updatePreferences } from '@/app/actions/profile';
import { unitsLabel } from '@/lib/domain/units';
import { FOCUS_AREAS } from '@/lib/validations';
import type { Difficulty, Units } from '@/types/database';
import { DIFFICULTY_LABEL } from './cards';
import { ConfirmDialog, Sheet, Toggle } from './overlays';
import { useToast } from './toast';
import { Button, Card, ListRow, cx } from './ui';

type Focus = (typeof FOCUS_AREAS)[number];
const FOCUS_LABEL: Record<Focus, string> = { flexibility: 'Flexibility', strength: 'Strength', mobility: 'Mobility', cardio: 'Cardio', core: 'Core', stress_relief: 'Stress relief' };

export function ProfileSettings(p: { email: string | null; activeGoals: number; unread: number; focus: string[]; level: Difficulty; units: Units; reminders: boolean; reminderTime: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [sheet, setSheet] = useState<'focus' | 'level' | 'units' | null>(null);
  const [focus, setFocus] = useState<Focus[]>(p.focus.filter((f): f is Focus => (FOCUS_AREAS as readonly string[]).includes(f)));
  const [reminders, setReminders] = useState(p.reminders);
  const [time, setTime] = useState(p.reminderTime);
  const [confirmOut, setConfirmOut] = useState(false);

  const save = (patch: Parameters<typeof updatePreferences>[0], done?: () => void) =>
    start(async () => {
      const r = await updatePreferences(patch);
      if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t save', message: r.error });
      done?.();
      setSheet(null);
      toast({ title: 'Saved' });
      router.refresh();
    });

  const group = (title: string, children: React.ReactNode) => (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="t-body text-text-secondary">{title}</h2>
      <Card className="divide-y divide-divider overflow-hidden">{children}</Card>
    </section>
  );

  return (
    <>
      {group(
        'Training',
        <>
          <ListRow icon={Target} label="Fitness goals" value={`${p.activeGoals} active`} href="/goals" />
          <ListRow icon={History} label="Workout history" href="/history" />
          <ListRow icon={Dumbbell} label="Preferred workouts" value={focus.map((f) => FOCUS_LABEL[f]).join(', ') || 'None'} onClick={() => setSheet('focus')} />
          <ListRow icon={Gauge} label="Experience level" value={DIFFICULTY_LABEL[p.level]} onClick={() => setSheet('level')} />
          <ListRow icon={Scale} label="Body measurements" href="/measurements" />
        </>,
      )}
      {group(
        'Preferences',
        <>
          <ListRow icon={Ruler} label="Units" value={unitsLabel(p.units)} onClick={() => setSheet('units')} />
          <ListRow
            icon={BellRing}
            label="Workout reminders"
            trailing={
              <Toggle
                checked={reminders}
                label="Workout reminders"
                disabled={pending}
                onChange={(v) => {
                  setReminders(v);
                  save({ remindersEnabled: v }, undefined);
                }}
              />
            }
          />
          {reminders ? (
            <div className="flex min-h-[68px] items-center gap-4 px-4">
              <label htmlFor="rem-time" className="t-item flex-1 pl-[60px]">
                Reminder time
              </label>
              <input id="rem-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} onBlur={() => time !== p.reminderTime && /^\d{2}:\d{2}$/.test(time) && save({ reminderTime: time })} className="h-10 rounded-[12px] bg-surface-muted px-3 t-item" />
            </div>
          ) : null}
          <ListRow icon={Bell} label="Notifications" value={p.unread ? `${p.unread} new` : undefined} href="/notifications" />
        </>,
      )}
      {group(
        'Account',
        <>
          <ListRow icon={KeyRound} label="Change password" value={p.email ?? undefined} href="/auth/update-password" />
          <ListRow icon={LogOut} label="Sign out" danger onClick={() => setConfirmOut(true)} />
        </>,
      )}
      <p className="t-caption text-text-muted">
        Reminder preferences are stored with your profile; PulseFit shows them in-app and does not send push or email reminders yet. Activity statistics are estimates for motivation, not medical advice.
      </p>

      <Sheet open={sheet === 'focus'} onClose={() => setSheet(null)} title="Preferred workouts" footer={<Button full loading={pending} onClick={() => save({ focus })}>Save</Button>}>
        <p className="mb-3 t-body text-text-secondary">Pick up to 3.</p>
        <div className="flex flex-wrap gap-2">
          {FOCUS_AREAS.map((f) => {
            const on = focus.includes(f);
            return (
              <button key={f} type="button" aria-pressed={on} disabled={!on && focus.length >= 3} onClick={() => setFocus(on ? focus.filter((x) => x !== f) : [...focus, f])} className={cx('h-11 rounded-full px-4 t-body-m disabled:opacity-40', on ? 'bg-ink text-on-ink' : 'bg-surface-muted')}>
                {FOCUS_LABEL[f]}
              </button>
            );
          })}
        </div>
      </Sheet>
      <Sheet open={sheet === 'level'} onClose={() => setSheet(null)} title="Experience level">
        <div className="flex flex-col gap-1">
          {(['beginner', 'intermediate', 'advanced'] as Difficulty[]).map((l) => (
            <button key={l} type="button" aria-pressed={p.level === l} onClick={() => save({ experienceLevel: l })} className={cx('min-h-14 rounded-[16px] px-4 text-left t-item', p.level === l && 'bg-surface-muted')}>
              {DIFFICULTY_LABEL[l]}
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === 'units'} onClose={() => setSheet(null)} title="Units">
        <div className="flex flex-col gap-1">
          {(['metric', 'imperial'] as Units[]).map((u) => (
            <button key={u} type="button" aria-pressed={p.units === u} onClick={() => save({ preferredUnits: u })} className={cx('min-h-14 rounded-[16px] px-4 text-left t-item', p.units === u && 'bg-surface-muted')}>
              {unitsLabel(u)}
            </button>
          ))}
          <p className="mt-2 t-caption text-text-muted">Values are stored in metric and converted for display, so switching never changes your records.</p>
        </div>
      </Sheet>
      <ConfirmDialog open={confirmOut} title="Sign out?" message="You’ll need your email and password to sign back in." cancelLabel="Stay signed in" confirmLabel="Sign out" onCancel={() => setConfirmOut(false)} onConfirm={() => start(() => signOut())} loading={pending} />
    </>
  );
}
