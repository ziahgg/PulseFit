import type { Metadata } from 'next';

import { TrendLine } from '@/components/charts';
import { MeasurementsPanel } from '@/components/measurements-panel';
import { Screen } from '@/components/screen';
import { Card, Chip, TopBar } from '@/components/ui';
import { appContext } from '@/lib/app-context';
import { addDays, shortDate } from '@/lib/domain/dates';
import { displayLength, displayWeight, lengthLabel, weightLabel } from '@/lib/domain/units';
import { listMeasurements } from '@/lib/services/data';
import type { BodyMetric, Units } from '@/types/database';

export const metadata: Metadata = { title: 'Body measurements' };

const METRICS: { id: BodyMetric; label: string }[] = [
  { id: 'weight', label: 'Weight' },
  { id: 'body_fat', label: 'Body fat' },
  { id: 'waist', label: 'Waist' },
  { id: 'chest', label: 'Chest' },
  { id: 'hips', label: 'Hips' },
];
const RANGES = { '30d': 30, '90d': 90, '1y': 365, all: null } as const;

const toDisplay = (type: BodyMetric, v: number, u: Units) => (type === 'weight' ? displayWeight(v, u) : type === 'body_fat' ? v : displayLength(v, u));
const unitFor = (type: BodyMetric, u: Units) => (type === 'weight' ? weightLabel(u) : type === 'body_fat' ? '%' : lengthLabel(u));

export default async function MeasurementsPage({ searchParams }: { searchParams: Promise<{ type?: string; range?: string }> }) {
  const sp = await searchParams;
  const { db, userId, today, profile } = await appContext();
  const type = METRICS.some((m) => m.id === sp.type) ? (sp.type as BodyMetric) : 'weight';
  const range = (sp.range && sp.range in RANGES ? sp.range : '90d') as keyof typeof RANGES;
  const days = RANGES[range];
  const rows = await listMeasurements(db, userId, type, days ? `${addDays(today, -days)}T00:00:00Z` : undefined);
  const u = profile.preferred_units;
  const unit = unitFor(type, u);
  const points = [...rows].reverse().map((r) => ({ label: shortDate(r.measured_at.slice(0, 10)), value: toDisplay(type, Number(r.value), u) }));
  const change = points.length >= 2 ? Math.round((points[points.length - 1].value - points[0].value) * 10) / 10 : null;

  return (
    <Screen>
      <TopBar title="Body measurements" back="/profile" />
      <nav aria-label="Measurement" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {METRICS.map((m) => (
          <Chip key={m.id} selected={type === m.id} href={`/measurements?type=${m.id}&range=${range}`}>
            {m.label}
          </Chip>
        ))}
      </nav>
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-3">
          <div>
            <p className="t-body text-text-secondary">Latest</p>
            <p className="t-metric-l num">{points.length ? `${points[points.length - 1].value} ${unit}` : '—'}</p>
            {change !== null ? (
              <p className="t-body text-text-muted">
                {change > 0 ? '+' : ''}
                {change} {unit} in this range
              </p>
            ) : null}
          </div>
          <div className="flex gap-2" role="group" aria-label="Date range">
            {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
              <Chip key={r} selected={range === r} href={`/measurements?type=${type}&range=${r}`} className="h-8 px-3">
                {r === 'all' ? 'All' : r}
              </Chip>
            ))}
          </div>
        </div>
        {points.length >= 2 ? (
          <TrendLine points={points} format={(v) => `${v} ${unit}`} summary={`${METRICS.find((m) => m.id === type)?.label} from ${points[0].value} to ${points[points.length - 1].value} ${unit}`} />
        ) : (
          <p className="rounded-[16px] bg-surface-muted p-4 t-body text-text-secondary">{points.length ? 'Add one more entry to see a trend.' : 'No entries in this range yet.'}</p>
        )}
      </Card>
      <MeasurementsPanel
        type={type}
        units={u}
        today={today}
        rows={rows.map((r) => ({ id: r.id, date: r.measured_at.slice(0, 10), value: Number(r.value), display: toDisplay(type, Number(r.value), u), notes: r.notes }))}
      />
      <p className="t-caption text-text-muted">Measurements are for your own tracking and aren’t medical advice. Values are stored in metric (kg, cm).</p>
    </Screen>
  );
}
