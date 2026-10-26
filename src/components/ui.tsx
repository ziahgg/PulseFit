import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentType, InputHTMLAttributes, ReactNode, SVGProps } from 'react';

import { ArrowLeft, ChevronRight, CircleAlert, X } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }>;

/* ───────────── Buttons ───────────── */

type Variant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'danger';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink text-on-ink hover:bg-ink-soft',
  brand: 'bg-brand text-on-brand hover:brightness-95',
  secondary: 'bg-surface text-text border border-border hover:bg-surface-muted',
  ghost: 'bg-transparent text-text hover:bg-surface-muted',
  danger: 'bg-error-soft text-error hover:brightness-95',
};
const btn = (variant: Variant, size: 'lg' | 'sm', full?: boolean) =>
  cx(
    'inline-flex items-center justify-center gap-2 rounded-full transition-[background,filter,transform] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-text disabled:border-transparent',
    size === 'lg' ? 'h-14 px-7 t-button' : 'h-10 px-4 t-button-s',
    VARIANT[variant],
    full && 'w-full',
  );

/** Figma "Button": 56 px (large) / 40 px (small), pill. */
export function Button({
  variant = 'primary',
  size = 'lg',
  full,
  icon: Icon,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'lg' | 'sm'; full?: boolean; icon?: IconType; loading?: boolean }) {
  return (
    <button {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={cx(btn(variant, size, full), className)}>
      {loading ? <Spinner small /> : Icon ? <Icon size={size === 'lg' ? 20 : 16} aria-hidden /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = 'primary', size = 'lg', full, icon: Icon, className, children }: { href: string; variant?: Variant; size?: 'lg' | 'sm'; full?: boolean; icon?: IconType; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={cx(btn(variant, size, full), className)}>
      {Icon ? <Icon size={size === 'lg' ? 20 : 16} aria-hidden /> : null}
      {children}
    </Link>
  );
}

/** Figma "Icon button": 44 px (or 34 px) circle. */
export function IconButton({
  icon: Icon,
  label,
  href,
  onClick,
  look = 'surface',
  size = 'lg',
  className,
  disabled,
  pressed,
  type = 'button',
}: {
  icon: IconType;
  label: string;
  href?: string;
  onClick?: () => void;
  look?: 'surface' | 'ink' | 'muted' | 'glass' | 'brand';
  size?: 'lg' | 'md' | 'sm';
  className?: string;
  disabled?: boolean;
  pressed?: boolean;
  type?: 'button' | 'submit';
}) {
  const cls = cx(
    'inline-flex shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40',
    size === 'lg' ? 'size-11' : size === 'md' ? 'size-10' : 'size-[34px]',
    look === 'surface' && 'bg-surface border border-border text-text hover:bg-surface-muted',
    look === 'ink' && 'bg-ink text-on-ink hover:bg-ink-soft',
    look === 'muted' && 'bg-surface-muted text-text hover:bg-divider',
    look === 'glass' && 'bg-white/85 text-text backdrop-blur hover:bg-white',
    look === 'brand' && 'bg-brand text-on-brand',
    className,
  );
  const icon = <Icon size={size === 'sm' ? 16 : 20} aria-hidden />;
  if (href)
    return (
      <Link href={href} aria-label={label} className={cls}>
        {icon}
      </Link>
    );
  return (
    <button type={type} aria-label={label} aria-pressed={pressed} onClick={onClick} disabled={disabled} className={cls}>
      {icon}
    </button>
  );
}

export function Spinner({ small, label = 'Loading' }: { small?: boolean; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <span className={cx('rounded-full border-2 border-current border-t-transparent anim-spin', small ? 'size-4' : 'size-6')} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/* ───────────── Chips, tags, pills ───────────── */

/** Figma "Filter chip": selected = ink. */
export function Chip({ selected, children, onClick, href, className }: { selected: boolean; children: ReactNode; onClick?: () => void; href?: string; className?: string }) {
  const cls = cx('inline-flex h-10 shrink-0 items-center rounded-full px-4 t-body-m transition-colors', selected ? 'bg-ink text-on-ink' : 'border border-border bg-transparent text-text-secondary hover:bg-surface', className);
  if (href)
    return (
      <Link href={href} aria-current={selected ? 'true' : undefined} className={cls} scroll={false}>
        {children}
      </Link>
    );
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export type Tone = 'brand' | 'success' | 'warning' | 'error' | 'neutral' | 'ink';
const TONE: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  error: 'bg-error-soft text-error',
  neutral: 'bg-surface-muted text-text-secondary',
  ink: 'bg-ink text-on-ink',
};

export function Tag({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex h-6 shrink-0 items-center rounded-full px-2.5 t-label whitespace-nowrap', TONE[tone], className)}>{children}</span>;
}

/** White pill with icon used on photo cards ("25 min", "Beginner", "Mat"). */
export function MetaPill({ icon: Icon, children, dark }: { icon: IconType; children: ReactNode; dark?: boolean }) {
  return (
    <span className={cx('inline-flex h-8 items-center gap-1.5 rounded-full px-3 t-body-m', dark ? 'bg-ink text-on-ink' : 'bg-white/90 text-text')}>
      <Icon size={16} aria-hidden />
      {children}
    </span>
  );
}

/** Inline meta (icon + text, muted) used in list rows. */
export function Meta({ icon: Icon, children }: { icon: IconType; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 t-body text-text-muted">
      <Icon size={14} aria-hidden />
      {children}
    </span>
  );
}

/* ───────────── Layout ───────────── */

export function Card({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' | 'li' }) {
  return <As className={cx('rounded-[24px] bg-surface', className)}>{children}</As>;
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="t-title-xl">{title}</h1>
        {subtitle ? <p className="t-body text-text-muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </header>
  );
}

/** Figma "Top bar": circular back/close, centred title, optional right action. */
export function TopBar({ title, back, close, right }: { title: string; back?: string; close?: string; right?: ReactNode }) {
  return (
    <header className="flex h-12 items-center justify-between gap-2">
      {back || close ? <IconButton icon={close ? X : ArrowLeft} label={close ? 'Close' : 'Back'} href={back ?? close} /> : <span className="size-11" aria-hidden />}
      <h1 className="t-title min-w-0 flex-1 truncate text-center">{title}</h1>
      {right ?? <span className="size-11" aria-hidden />}
    </header>
  );
}

export function SectionHeader({ title, href, linkLabel = 'See all', id }: { title: string; href?: string; linkLabel?: string; id?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="t-section">
        {title}
      </h2>
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 t-body text-text-secondary hover:text-text">
          {linkLabel}
          <ChevronRight size={16} aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

/** Figma "Stat card": icon disc, label, metric. `dark` = ink variant. */
export function StatCard({ icon: Icon, label, value, dark, className }: { icon?: IconType; label: string; value: ReactNode; dark?: boolean; className?: string }) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-1 rounded-[20px] p-4', dark ? 'bg-ink text-on-ink' : 'bg-surface', className)}>
      {Icon ? (
        <span className={cx('mb-3 grid size-9 place-items-center rounded-full', dark ? 'bg-white text-ink' : 'bg-ink text-on-ink')}>
          <Icon size={18} aria-hidden />
        </span>
      ) : null}
      <span className={cx('t-label', dark ? 'text-white/70' : 'text-text-muted')}>{label}</span>
      <span className="text-[16px] leading-6 font-semibold num hyphens-auto sm:t-metric-m">{value}</span>
    </div>
  );
}

export function ListRow({ icon: Icon, label, value, href, trailing, danger, onClick }: { icon: IconType; label: string; value?: string; href?: string; trailing?: ReactNode; danger?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <span className={cx('grid size-11 shrink-0 place-items-center rounded-[14px]', danger ? 'bg-error-soft text-error' : 'bg-surface-muted text-text')}>
        <Icon size={20} aria-hidden />
      </span>
      <span className={cx('t-item min-w-0 shrink-0 text-left', danger && 'text-error')}>{label}</span>
      <span className="min-w-0 flex-1 truncate text-right t-body text-text-muted">{value}</span>
      {trailing ?? (href || onClick ? <ChevronRight size={18} className="shrink-0 text-text-muted" aria-hidden /> : null)}
    </>
  );
  const cls = 'flex min-h-[68px] w-full items-center gap-4 px-4 py-3';
  if (href)
    return (
      <Link href={href} className={cx(cls, 'hover:bg-surface-muted/60')}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cx(cls, 'hover:bg-surface-muted/60')}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}

export function EmptyState({ icon: Icon, title, message, action }: { icon: IconType; title: string; message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[24px] bg-surface px-6 py-10 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-surface-muted text-text-secondary">
        <Icon size={28} aria-hidden />
      </span>
      <h2 className="t-section">{title}</h2>
      <p className="t-body max-w-[300px] text-text-secondary">{message}</p>
      {action}
    </div>
  );
}

export function InfoNote({ icon: Icon, children, tone = 'muted' }: { icon: IconType; children: ReactNode; tone?: 'muted' | 'brand' }) {
  return (
    <p className={cx('flex gap-2.5 rounded-[16px] p-3 t-body', tone === 'brand' ? 'bg-brand-soft text-text' : 'bg-surface-muted text-text-secondary')}>
      <Icon size={18} className="mt-px shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/* ───────────── Inputs ───────────── */

export function Field({ label, error, hint, className, id, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; id: string }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="t-label text-text-secondary">
        {label}
      </label>
      <input
        id={id}
        {...input}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={cx(
          'h-14 w-full rounded-[18px] bg-surface px-4 t-item text-text outline-none placeholder:text-text-muted',
          error ? 'border-[1.5px] border-error' : 'border border-border focus:border-[1.5px] focus:border-ink',
        )}
      />
      <FieldMessage id={`${id}-msg`} error={error} hint={hint} />
    </div>
  );
}

export function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error)
    return (
      <p id={id} role="alert" className="flex items-center gap-1.5 t-label text-error">
        <CircleAlert size={14} aria-hidden />
        {error}
      </p>
    );
  return hint ? (
    <p id={id} className="t-caption text-text-muted">
      {hint}
    </p>
  ) : null;
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-center gap-2 rounded-[16px] bg-error-soft px-4 py-3 t-body text-error">
      <CircleAlert size={16} aria-hidden />
      {message}
    </p>
  );
}

/* ───────────── Progress ───────────── */

/** Orange progress ring (weekly goal). */
export function Ring({ value, size = 128, stroke = 14, track = 'var(--ink-soft)', label, children }: { value: number; size?: number; stroke?: number; track?: string; label: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {v > 0 ? <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--brand)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${v * c} ${c}`} /> : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
    </div>
  );
}
