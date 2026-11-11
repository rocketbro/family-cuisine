// When the tidy-up runs: once in every period of three days, at night after the top-up and before the household is up.
import { addDays, type ISODate } from './dates.ts';

export const TIDY_EVERY_DAYS = 3;
/** The nightly top-up starts at 3 AM; the morning notices start at 6. */
export const TIDY_FROM_HOUR = 4;
export const TIDY_BEFORE_HOUR = 6;

/** Whole days since 1970-01-01 for a calendar date, with no time zone in it. */
function dayNumber(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** The first day of the three-day period `today` falls in, which keys the run. */
export function tidyPeriod(today: ISODate): ISODate {
  return addDays(today, -(dayNumber(today) % TIDY_EVERY_DAYS));
}

export const tidyUpWindowOpen = (hour: number): boolean => hour >= TIDY_FROM_HOUR && hour < TIDY_BEFORE_HOUR;
