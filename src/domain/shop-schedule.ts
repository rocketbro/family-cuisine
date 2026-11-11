// When the groceries come in. Trips are dates, chosen one at a time. After the last one chosen, the
// next is a week later, and so on, until someone picks a different day.
import { addDays, dateRange, fromISODate, type ISODate } from './dates.ts';

export type ShopSchedule = {
  /** The trips on record, in order. Never empty: with none chosen yet, it holds one that starts the weekly rhythm. */
  trips: readonly ISODate[];
};

const WEEK = 7;

function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((fromISODate(to).getTime() - fromISODate(from).getTime()) / 86_400_000);
}

/** The next trip on or after a date. */
export function nextTrip(today: ISODate, { trips }: ShopSchedule): ISODate {
  const first = trips[0];
  const last = trips[trips.length - 1];
  if (today < first) return addDays(first, -WEEK * Math.floor(daysBetween(today, first) / WEEK));
  if (today > last) return addDays(last, WEEK * Math.ceil(daysBetween(last, today) / WEEK));
  return trips.find(trip => trip >= today) ?? last;
}

/** The latest trip on or before a date. */
function latestTrip(date: ISODate, { trips }: ShopSchedule): ISODate {
  const first = trips[0];
  const last = trips[trips.length - 1];
  if (date < first) return addDays(first, -WEEK * Math.ceil(daysBetween(date, first) / WEEK));
  if (date >= last) return addDays(last, WEEK * Math.floor(daysBetween(last, date) / WEEK));
  return trips.filter(trip => trip <= date).at(-1) ?? first;
}

/**
 * Puts a trip on a different day. Trips before it stay on record, including the weekly ones that
 * were only ever implied, so history doesn't shift. Anything later than it is dropped: weeks count on from the new day.
 */
export function withTripMoved(trips: readonly ISODate[], from: ISODate, to: ISODate): ISODate[] {
  const kept = trips.filter(trip => trip < from);
  const last = trips.at(-1);
  if (last) for (let implied = addDays(last, WEEK); implied < from; implied = addDays(implied, WEEK)) kept.push(implied);
  return [...new Set([...kept, to])].sort();
}

/**
 * Days before the next shopping trip can only have meals the pantry already covers: no
 * groceries arrive in between. Today always counts, even on shopping day.
 */
export function beforeGroceries(date: ISODate, today: ISODate, schedule: ShopSchedule): boolean {
  return date === today || date < nextTrip(today, schedule);
}

/** The last day one trip's groceries cover: the day before the trip after it. */
export function tripCoversThrough(trip: ISODate, schedule: ShopSchedule): ISODate {
  return addDays(nextTrip(addDays(trip, 1), schedule), -1);
}

/** The days between grocery runs: from a trip through the day before the next one. */
export type TripWindow = { start: ISODate; end: ISODate };

/** The window a date falls in. A trip day belongs to the window it starts. */
export function tripWindow(date: ISODate, schedule: ShopSchedule): TripWindow {
  const start = latestTrip(date, schedule);
  return { start, end: tripCoversThrough(start, schedule) };
}

export function previousTripWindow(window: TripWindow, schedule: ShopSchedule): TripWindow {
  return tripWindow(addDays(window.start, -1), schedule);
}

export function nextTripWindow(window: TripWindow, schedule: ShopSchedule): TripWindow {
  return tripWindow(addDays(window.end, 1), schedule);
}

/**
 * The end of what the coming trip covers: asked on a Sunday with a Wednesday trip, that is
 * next Tuesday.
 */
export function planHorizonEnd(today: ISODate, schedule: ShopSchedule): ISODate {
  return tripCoversThrough(nextTrip(today, schedule), schedule);
}

/** Every trip day between two dates, for marking them on the week. */
export function tripsBetween(from: ISODate, to: ISODate, schedule: ShopSchedule): ISODate[] {
  const trips = new Set<ISODate>();
  for (let d = nextTrip(from, schedule); d <= to; d = nextTrip(addDays(d, 1), schedule)) trips.add(d);
  return dateRange(from, to).filter(d => trips.has(d));
}
