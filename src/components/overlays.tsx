'use client';

import { CircleAlert, Minus, Plus, X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { Button, cx } from './ui';

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

/** Figma bottom sheet: grabber, title + close, body, optional footer. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEscape(open, onClose);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => prev?.focus?.();
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <div className="anim-fade absolute inset-0 bg-[var(--scrim)]" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="anim-sheet relative flex max-h-[88dvh] w-full max-w-[480px] flex-col rounded-t-[32px] bg-surface outline-none lg:rounded-[32px]">
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-disabled lg:hidden" aria-hidden />
        <div className="flex shrink-0 items-center justify-between px-6 pt-4 pb-3">
          <h2 id={titleId} className="t-title">
            {title}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-11 place-items-center rounded-full bg-surface-muted">
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">{children}</div>
        {footer ? <div className="shrink-0 px-6 pt-2 pb-[max(24px,env(safe-area-inset-bottom))]">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Figma "End workout?" dialog: orange alert disc, title, message, primary + secondary. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger,
  loading,
  onDismiss,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  loading?: boolean;
  /** Escape / scrim; defaults to onCancel. */
  onDismiss?: () => void;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dismiss = onDismiss ?? onCancel;
  useEscape(open, dismiss);
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-7">
      <div className="anim-fade absolute inset-0 bg-[var(--scrim)]" onClick={dismiss} aria-hidden />
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="anim-fade relative flex w-full max-w-[360px] flex-col items-center gap-3 rounded-[32px] bg-surface p-7 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-brand-soft text-brand">
          <CircleAlert size={26} aria-hidden />
        </span>
        <h2 id={titleId} className="t-title">
          {title}
        </h2>
        <div className="t-body text-text-secondary">{message}</div>
        <div className="mt-2 flex w-full flex-col gap-3">
          <button ref={cancelRef} type="button" onClick={onCancel} className="h-14 rounded-full bg-ink t-button text-on-ink">
            {cancelLabel}
          </button>
          <Button variant={danger ? 'danger' : 'secondary'} full onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Figma toggle: ink when on. */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-ink' : 'bg-disabled')}
    >
      <span className={cx('absolute top-1 size-6 rounded-full bg-white shadow transition-[left]', checked ? 'left-[28px]' : 'left-1')} />
    </button>
  );
}

/** Figma stepper: − value + with caption. */
export function Stepper({ value, onChange, min, max, step = 1, caption, label }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; caption: string; label: string }) {
  const round = (v: number) => Math.round(v * 100) / 100;
  return (
    <div className="flex items-center justify-between gap-3" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(round(Math.max(min, value - step)))} className="grid size-14 shrink-0 place-items-center rounded-full bg-surface-muted disabled:opacity-40">
        <Minus size={22} aria-hidden />
      </button>
      <div className="flex flex-col items-center">
        <output aria-live="polite" className="t-metric-xl num">
          {value}
        </output>
        <span className="t-label text-text-muted">{caption}</span>
      </div>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(round(Math.min(max, value + step)))} className="grid size-14 shrink-0 place-items-center rounded-full bg-ink text-on-ink disabled:opacity-40">
        <Plus size={22} aria-hidden />
      </button>
    </div>
  );
}
