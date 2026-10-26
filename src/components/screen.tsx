import type { ReactNode } from 'react';

import { cx } from './ui';

/** Page column: 20 px margins, room for the bottom bar on mobile, centred on large screens. */
export function Screen({ children, className, footer }: { children: ReactNode; className?: string; footer?: ReactNode }) {
  return (
    <>
      <main className={cx('mx-auto flex w-full max-w-[760px] flex-col gap-5 px-5 pt-[max(20px,env(safe-area-inset-top))] lg:px-10 lg:pt-10', footer ? 'pb-36' : 'pb-32 lg:pb-12', className)}>
        {children}
      </main>
      {footer ? (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-bg from-70% to-transparent px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-[720px] gap-3">{footer}</div>
        </div>
      ) : null}
    </>
  );
}
