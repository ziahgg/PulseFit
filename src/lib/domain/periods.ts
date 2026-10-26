import { addDays, daysBetween, isLocalDate, lastMonthsRange, monthLabel, monthRange, monthSpanLabel, rangeLabel, rangeLabelShort, weekRange, type DateRange, type LocalDate } from './dates';

export const PERIODS = ['this_week', 'last_week', 'month', 'three_months', 'custom'] as const;
export type PeriodId = (typeof PERIODS)[number];

export interface Period {
  id: PeriodId;
  range: DateRange;
  title: string;
  subtitle: string;
  /** Chart granularity: daily bars for ranges up to two weeks, weekly bars otherwise. */
  bars: 'days' | 'weeks';
}

const MAX_CUSTOM_DAYS = 366;

/** Report periods from the Figma "Select period" sheet. Custom ranges are clamped to one year. */
export function resolvePeriod(id: string | undefined, today: LocalDate, from?: string, to?: string): Period {
  switch (id) {
    case 'last_week': {
      const range = weekRange(addDays(today, -7));
      return { id: 'last_week', range, title: 'Last week', subtitle: rangeLabelShort(range), bars: 'days' };
    }
    case 'month': {
      const range = monthRange(today);
      return { id: 'month', range, title: 'This month', subtitle: monthLabel(today), bars: 'weeks' };
    }
    case 'three_months': {
      const range = lastMonthsRange(today, 3);
      return { id: 'three_months', range, title: 'Last 3 months', subtitle: monthSpanLabel(range), bars: 'weeks' };
    }
    case 'custom': {
      if (from && to && isLocalDate(from) && isLocalDate(to) && from <= to) {
        const end = daysBetween(from, to) > MAX_CUSTOM_DAYS ? addDays(from, MAX_CUSTOM_DAYS) : to;
        const range = { start: from, end };
        return { id: 'custom', range, title: 'Custom range', subtitle: rangeLabel(range), bars: daysBetween(from, end) <= 13 ? 'days' : 'weeks' };
      }
      return resolvePeriod('this_week', today);
    }
    default: {
      const range = weekRange(today);
      return { id: 'this_week', range, title: 'This week', subtitle: rangeLabel(range), bars: 'days' };
    }
  }
}

/** Monday-start weeks overlapping a range, each clipped to the range. */
export function weeksIn(range: DateRange): DateRange[] {
  const out: DateRange[] = [];
  for (let s = weekRange(range.start).start; s <= range.end; s = addDays(s, 7)) {
    out.push({ start: s < range.start ? range.start : s, end: addDays(s, 6) > range.end ? range.end : addDays(s, 6) });
  }
  return out;
}
