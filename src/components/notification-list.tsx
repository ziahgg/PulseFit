'use client';

import { BellRing, CalendarDays, CircleCheck, Flame, Target, Trophy, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { markNotificationsRead } from '@/app/actions/profile';
import type { NotificationKind, NotificationRow } from '@/types/database';
import { useToast } from './toast';
import { Button, cx } from './ui';

const STYLE: Record<NotificationKind, { icon: LucideIcon; cls: string }> = {
  reminder: { icon: BellRing, cls: 'text-brand' },
  streak: { icon: Flame, cls: 'bg-brand-soft text-brand' },
  habit: { icon: CircleCheck, cls: 'bg-success-soft text-success' },
  goal: { icon: Target, cls: 'bg-success-soft text-success' },
  personal_best: { icon: Trophy, cls: 'bg-warning-soft text-warning' },
  summary: { icon: CalendarDays, cls: 'bg-surface-muted text-text' },
};

type Item = NotificationRow & { group: string; when: string };

export function NotificationList({ items }: { items: Item[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const unread = items.filter((i) => !i.read_at);
  const groups = ['Today', 'This week', 'Earlier'].map((g) => ({ g, list: items.filter((i) => i.group === g) })).filter((x) => x.list.length);

  const open = (n: Item) =>
    start(async () => {
      if (!n.read_at) await markNotificationsRead([n.id]);
      if (n.link) router.push(n.link);
      else router.refresh();
    });

  return (
    <>
      {unread.length ? (
        <Button
          size="sm"
          variant="secondary"
          className="self-end"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await markNotificationsRead();
              if (!r.ok) toast({ kind: 'error', title: 'Couldn’t update', message: r.error });
              router.refresh();
            })
          }
        >
          Mark all as read
        </Button>
      ) : null}
      {groups.map(({ g, list }) => (
        <section key={g} aria-label={g} className="flex flex-col gap-2">
          <h2 className="t-body text-text-secondary">{g}</h2>
          <ul className="divide-y divide-divider overflow-hidden rounded-[24px] bg-surface">
            {list.map((n) => {
              const s = STYLE[n.kind];
              const isUnread = !n.read_at;
              return (
                <li key={n.id}>
                  <button type="button" onClick={() => open(n)} className={cx('flex w-full items-start gap-4 px-5 py-4 text-left', isUnread && n.kind === 'reminder' && 'bg-brand-soft', isUnread && n.kind !== 'reminder' && 'bg-surface-muted/60')}>
                    <span className={cx('grid size-11 shrink-0 place-items-center rounded-full', s.cls)}>
                      <s.icon size={20} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="t-item block">{n.title}</span>
                      {n.body ? <span className="t-body block text-text-secondary">{n.body}</span> : null}
                      <span className="t-caption block text-text-muted">
                        {n.when}
                        {isUnread ? ' · Unread' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
