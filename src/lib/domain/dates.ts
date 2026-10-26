/**
 * Calendar helpers. Dates are plain "YYYY-MM-DD" strings for the user's local calendar
 * (computed with their profile timezone). Weeks start on Monday (ISO).
 */

export type LocalDate = string;

export interface DateRange {
  start: LocalDate; // inclusive
  end: LocalDate; // inclusive
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toUTC = (d: LocalDate) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
};
const fromUTC = (d: Date): LocalDate => d.toISOString().slice(0, 10);

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const safeTz = (tz: string) => (isValidTimeZone(tz) ? tz : 'UTC');

/** The calendar date of an instant in a timezone. */
export function localDate(instant: Date | string, timeZone: string): LocalDate {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: safeTz(timeZone), year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** "6:34 PM" in a timezone. */
export function localTime(instant: Date | string, timeZone: string): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  return new Intl.DateTimeFormat('en-US', { timeZone: safeTz(timeZone), hour: 'numeric', minute: '2-digit' }).format(d);
}

export function addDays(date: LocalDate, n: number): LocalDate {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: LocalDate): number {
  return ((toUTC(date).getUTCDay() + 6) % 7) + 1;
}

export function weekRange(date: LocalDate): DateRange {
  const start = addDays(date, 1 - isoWeekday(date));
  return { start, end: addDays(start, 6) };
}

export function monthRange(date: LocalDate): DateRange {
  const d = toUTC(date);
  return {
    start: fromUTC(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))),
    end: fromUTC(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))),
  };
}

/** From the first day of the month `months - 1` months back through the end of `date`'s month. */
export function lastMonthsRange(date: LocalDate, months: number): DateRange {
  const d = toUTC(date);
  return {
    start: fromUTC(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (months - 1), 1))),
    end: monthRange(date).end,
  };
}

export function inRange(date: LocalDate, r: DateRange): boolean {
  return date >= r.start && date <= r.end;
}

export function eachDay(r: DateRange): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = r.start; d <= r.end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function dayNumber(date: LocalDate): number {
  return toUTC(date).getUTCDate();
}

export function weekdayShort(date: LocalDate): string {
  return DAYS[toUTC(date).getUTCDay()];
}

/** "Oct 26" */
export function shortDate(date: LocalDate): string {
  const d = toUTC(date);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Thu, Oct 29" */
export function dayLabel(date: LocalDate): string {
  return `${weekdayShort(date)}, ${shortDate(date)}`;
}

/** "Oct 26 – Nov 1, 2026" (start year added when the range crosses years). */
export function rangeLabel(r: DateRange): string {
  const ya = toUTC(r.start).getUTCFullYear();
  const yb = toUTC(r.end).getUTCFullYear();
  return `${shortDate(r.start)}${ya === yb ? '' : `, ${ya}`} – ${shortDate(r.end)}, ${yb}`;
}

/** "Oct 19 – Oct 25" */
export function rangeLabelShort(r: DateRange): string {
  return `${shortDate(r.start)} – ${shortDate(r.end)}`;
}

/** "October 2026" */
export function monthLabel(date: LocalDate): string {
  const d = toUTC(date);
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Mar 2026" */
export function monthShortLabel(date: LocalDate): string {
  const d = toUTC(date);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Aug – Oct 2026" */
export function monthSpanLabel(r: DateRange): string {
  const a = toUTC(r.start);
  const b = toUTC(r.end);
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${monthShortLabel(r.start)} – ${monthShortLabel(r.end)}`;
  if (a.getUTCMonth() === b.getUTCMonth()) return monthLabel(r.start);
  return `${MONTHS[a.getUTCMonth()]} – ${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}

export function isLocalDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && fromUTC(toUTC(v)) === v;
}
