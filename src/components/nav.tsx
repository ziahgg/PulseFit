'use client';

import { Bookmark, ChartNoAxesColumn, Dumbbell, House, UserRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cx } from './ui';

const TABS: { href: string; label: string; icon: LucideIcon; match: string[] }[] = [
  { href: '/home', label: 'Home', icon: House, match: ['/home', '/notifications'] },
  { href: '/workouts', label: 'Workouts', icon: Dumbbell, match: ['/workouts', '/exercises'] },
  { href: '/activity', label: 'Activity', icon: ChartNoAxesColumn, match: ['/activity', '/history'] },
  { href: '/saved', label: 'Saved', icon: Bookmark, match: ['/saved'] },
  { href: '/profile', label: 'Profile', icon: UserRound, match: ['/profile', '/goals', '/measurements'] },
];

/** Figma bottom bar: 5 labelled destinations; active = dark icon + label + orange indicator. Side rail on large screens. */
export function AppNav() {
  const path = usePathname();
  const active = (m: string[]) => m.some((p) => path === p || path.startsWith(`${p}/`));
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] bg-surface pb-[max(10px,env(safe-area-inset-bottom))] shadow-[var(--shadow-nav)] lg:inset-y-0 lg:right-auto lg:w-[232px] lg:rounded-none lg:border-r lg:border-border lg:pb-0 lg:shadow-none">
      <div className="hidden items-center gap-2.5 px-6 pt-8 pb-6 lg:flex">
        <span className="grid size-9 place-items-center rounded-full bg-brand text-on-brand">
          <PulseMark />
        </span>
        <span className="t-section">PulseFit</span>
      </div>
      <ul className="mx-auto flex max-w-[520px] justify-between px-2 pt-2.5 lg:max-w-none lg:flex-col lg:gap-1 lg:px-3 lg:pt-0">
        {TABS.map((t) => {
          const on = active(t.match);
          return (
            <li key={t.href} className="flex-1 lg:flex-none">
              <Link
                href={t.href}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'relative flex flex-col items-center gap-1 py-1.5 lg:flex-row lg:gap-3 lg:rounded-[14px] lg:px-4 lg:py-3',
                  on ? 'text-text lg:bg-surface-muted' : 'text-inactive hover:text-text-secondary',
                )}
              >
                <t.icon size={24} strokeWidth={on ? 2 : 1.75} aria-hidden />
                <span className="t-nav lg:t-item">{t.label}</span>
                {on ? <span className="mt-0.5 h-[3px] w-6 rounded-full bg-brand lg:absolute lg:left-0 lg:mt-0 lg:h-6 lg:w-[3px]" aria-hidden /> : <span className="mt-0.5 h-[3px] lg:hidden" aria-hidden />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Heart-rate glyph from the PulseFit logo. */
export function PulseMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
    </svg>
  );
}
