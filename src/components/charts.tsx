import { cx } from './ui';

export interface Bar {
  key: string;
  label: string;
  value: number;
  kind: 'active' | 'light' | 'none' | 'planned' | 'future';
  highlight?: boolean;
}

/**
 * Figma activity bars: dark ≥ 20 active min, grey < 20, dashed outline = planned.
 * Values print above bars; the whole chart has a text summary for screen readers.
 */
export function ActivityBars({ bars, unit = 'min', summary }: { bars: Bar[]; unit?: string; summary: string }) {
  const max = Math.max(30, ...bars.map((b) => b.value));
  const H = 150;
  return (
    <figure className="m-0">
      <div className="flex h-[200px] items-end gap-2 sm:gap-3" role="img" aria-label={summary}>
        {bars.map((b) => {
          const h = b.kind === 'planned' || b.kind === 'future' ? 48 : b.value > 0 ? Math.max(28, (b.value / max) * H) : 14;
          return (
            <div key={b.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2" aria-hidden>
              {b.value > 0 ? <span className="t-body text-text-secondary num">{b.value}</span> : null}
              <span
                className={cx(
                  'w-full max-w-[44px] rounded-full',
                  b.kind === 'active' && 'bg-ink',
                  b.kind === 'light' && 'bg-inactive',
                  b.kind === 'none' && 'bg-surface-muted',
                  b.kind === 'planned' && 'border-[1.5px] border-dashed border-disabled',
                  b.kind === 'future' && 'bg-transparent',
                )}
                style={{ height: h }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3" aria-hidden>
        {bars.map((b) => (
          <span key={b.key} className={cx('min-w-0 flex-1 truncate text-center t-body', b.highlight ? 't-body-m text-text' : 'text-text-muted')}>
            {b.label}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        {summary} ({unit})
      </figcaption>
    </figure>
  );
}

/** Weight trend line (canonical values, already converted for display). */
export function TrendLine({ points, format, summary }: { points: { label: string; value: number }[]; format: (v: number) => string; summary: string }) {
  if (points.length < 2) return null;
  const W = 320;
  const H = 120;
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo || 1) * 0.2;
  const y = (v: number) => 10 + (H - 20) * (1 - (v - (lo - pad)) / (hi - lo + 2 * pad));
  const x = (i: number) => 8 + (i * (W - 16)) / (points.length - 1);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={summary}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="var(--divider)" />
        ))}
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 5 : 3} fill={i === points.length - 1 ? 'var(--brand)' : 'var(--ink)'} stroke="var(--surface)" strokeWidth={2} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between t-caption text-text-muted" aria-hidden>
        <span>{points[0].label}</span>
        <span>
          {last.label} · {format(last.value)}
        </span>
      </div>
    </figure>
  );
}
