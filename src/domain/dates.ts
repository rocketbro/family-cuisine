// Calendar dates as YYYY-MM-DD strings in the household's local time. No time zones leak
// into the plan: a dinner belongs to a day, not an instant.

export type ISODate = string;

export function toISODate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function dayOfWeek(iso: ISODate): number {
  return fromISODate(iso).getDay();
}

export function dateRange(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The Sunday that starts the calendar week containing a date. */
export function weekStart(iso: ISODate): ISODate {
  return addDays(iso, -dayOfWeek(iso));
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function weekdayName(iso: ISODate): string {
  return WEEKDAYS[dayOfWeek(iso)];
}

export function longDate(iso: ISODate): string {
  const date = fromISODate(iso);
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** "November 4": the month spelled out, for headings. */
export function monthDay(iso: ISODate): string {
  const date = fromISODate(iso);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function shortDate(iso: ISODate): string {
  const date = fromISODate(iso);
  return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
}

/** True only for a date that exists: not month 99, not February 30. */
export function isRealDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(2000, 0, 1));
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** A date that came from a model, kept only if it exists. */
export function realDateOrNull(date: string | null | undefined): ISODate | null {
  return date && isRealDate(date) ? date : null;
}
