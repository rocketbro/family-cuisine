// Using things before they go bad. Only items where it matters carry a date, and one date is
// enough: the soonest. A date only ever flags an item. Whether food is still good is a person's
// call, so nothing here marks anything out.
import { addDays, shortDate, weekdayName, type ISODate } from './dates.ts';
import type { PantryItem, StockStatus } from './pantry.ts';

/** How close a date gets before the item moves to "Use soon". */
export const USE_SOON_DAYS = 4;

type Dated = Pick<PantryItem, 'status' | 'useBy' | 'useByEstimated' | 'lastsDays'>;
type DateChange = { status?: StockStatus; useBy?: ISODate | null; lastsDays?: number | null };

/** What an item's date becomes after a change. Every pantry write goes through this. */
export function dateAfterChange(item: Dated, change: DateChange, today: ISODate): Pick<PantryItem, 'useBy' | 'useByEstimated'> {
  if ((change.status ?? item.status) === 'out') return { useBy: null, useByEstimated: false };
  if (change.useBy !== undefined) return { useBy: change.useBy, useByEstimated: false };
  const lasts = change.lastsDays !== undefined ? change.lastsDays : item.lastsDays;
  // No date yet (just restocked, or new), or correcting an estimate: count from today.
  if (!item.useBy || (change.lastsDays !== undefined && item.useByEstimated)) {
    return lasts ? { useBy: addDays(today, lasts), useByEstimated: true } : { useBy: null, useByEstimated: false };
  }
  return { useBy: item.useBy, useByEstimated: item.useByEstimated };
}

/** Items in the house with a date within `days`, soonest first. Past dates stay on the list. */
export function goingOffSoon<T extends Pick<PantryItem, 'status' | 'useBy'>>(items: readonly T[], today: ISODate, days = USE_SOON_DAYS): T[] {
  const limit = addDays(today, days);
  return items
    .filter(i => i.status !== 'out' && i.useBy !== null && i.useBy <= limit)
    .sort((a, b) => a.useBy!.localeCompare(b.useBy!));
}

/** "use by Thursday", "use by about Nov 19", "past its date". */
export function dateWording(item: Pick<PantryItem, 'useBy' | 'useByEstimated'>, today: ISODate): string | null {
  if (!item.useBy) return null;
  if (item.useBy < today) return item.useByEstimated ? 'may be past its date' : 'past its date';
  const about = item.useByEstimated ? 'about ' : '';
  if (item.useBy === today) return `use ${about}today`;
  if (item.useBy === addDays(today, 1)) return `use by ${about}tomorrow`;
  if (item.useBy < addDays(today, 7)) return `use by ${about}${weekdayName(item.useBy)}`;
  return `use by ${about}${shortDate(item.useBy)}`;
}
