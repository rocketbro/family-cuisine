// Which date each line of a written plan means, and which days a review flips through.
import { addDays, dateRange, dayOfWeek, type ISODate } from './dates.ts';
import type { ImportRange } from './plan-import.ts';

/** A line's day as written: a date on the page, a named weekday (0 = Sunday), or neither. */
export type WrittenDay = { date: ISODate | null; weekday: number | null };

/**
 * Walks the lines in the order written, the way the person meant them. A named day is the first one
 * on or after the last day reached, so a day name that comes round again is the later date. A written
 * date wins and moves the walk there. A line with no day stays without one and doesn't move it.
 *
 * A list can start a little before the days being planned: Friday first on a napkin, planning from
 * Saturday, means yesterday's Friday and not next week's. So the walk starts wherever puts the most
 * lines in the range, and on a tie, on or after its first day.
 */
export function datesInWrittenOrder(lines: readonly WrittenDay[], range: ImportRange): (ISODate | null)[] {
  let best = walked(lines, range.from);
  for (let daysBefore = 1; daysBefore < 7; daysBefore++) {
    const walk = walked(lines, addDays(range.from, -daysBefore));
    if (linesInRange(walk, range) > linesInRange(best, range)) best = walk;
  }
  return best;
}

function walked(lines: readonly WrittenDay[], start: ISODate): (ISODate | null)[] {
  let cursor = start;
  return lines.map(({ date, weekday }) => {
    if (date) return (cursor = date);
    if (weekday === null) return null;
    return (cursor = addDays(cursor, (weekday - dayOfWeek(cursor) + 7) % 7));
  });
}

function linesInRange(dates: readonly (ISODate | null)[], { from, through }: ImportRange): number {
  return dates.filter(date => date !== null && date >= from && date <= through).length;
}

/**
 * The pages of a review, in date order: the days of the range still to come, and any day a meal is on,
 * in the range or not. A day gone by only shows if a meal landed on it, to say it won't be saved.
 */
export function reviewDays(range: ImportRange, mealDates: readonly ISODate[], today: ISODate): ISODate[] {
  const ahead = dateRange(range.from, range.through).filter(day => day >= today);
  return [...new Set([...ahead, ...mealDates])].sort();
}
