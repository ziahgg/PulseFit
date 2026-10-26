'use client';

import { CircleAlert, CircleCheck, type LucideIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { cx } from './ui';

interface ToastInput {
  title: string;
  message?: string;
  kind?: 'success' | 'error' | 'info';
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void };
}
type ToastState = ToastInput & { id: number };

const Ctx = createContext<(t: ToastInput) => void>(() => undefined);
export const useToast = () => useContext(Ctx);

/** Figma "Toast": ink card, orange icon disc, title + message, optional action (e.g. Undo). Announced politely. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((t: ToastInput) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), t.action ? 6000 : 3500);
  }, []);
  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);
  const Icon = toast?.icon ?? (toast?.kind === 'error' ? CircleAlert : CircleCheck);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(104px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-5 lg:bottom-8">
        {toast ? (
          <div key={toast.id} role="status" className="anim-toast pointer-events-auto flex w-full max-w-[430px] items-center gap-3 rounded-[20px] bg-ink py-3 pr-5 pl-3 text-on-ink shadow-[var(--shadow-toast)]">
            <span className={cx('grid size-10 shrink-0 place-items-center rounded-full', toast.kind === 'error' ? 'bg-error' : 'bg-brand')}>
              <Icon size={20} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="t-item">{toast.title}</p>
              {toast.message ? <p className="truncate t-label text-white/65">{toast.message}</p> : null}
            </div>
            {toast.action ? (
              <button
                type="button"
                className="shrink-0 t-button-s text-brand"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Ctx.Provider>
  );
}
