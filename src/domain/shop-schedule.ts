// When the groceries come in. There's a regular weekday, and any single week's trip can be
// moved ("this week we're going Friday") without changing the rest.
import { addDays, dateRange, dayOfWeek, type ISODate } from './dates.ts';

export type ShopSchedule = {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** One-off moves: the regular trip date → the day it's actually happening. */
  moved: Readonly<Record<ISODate, ISODate>>;
};

/** The regular trip day on or after a date. */
export function regularTrip(iso: ISODate, weekday: number): ISODate {
  return addDays(iso, (weekday - dayOfWeek(iso) + 7) % 7);
}

/** The next trip on or after a date, counting this week's move if there is one. */
export function nextTrip(today: ISODate, schedule: ShopSchedule): ISODate {
  const regular = regularTrip(today, schedule.weekday);
  // Last week's trip may have moved past today, and this week's may have moved past next week's.
  const candidates = [-7, 0, 7].map(k => addDays(regular, k)).map(d => schedule.moved[d] ?? d).filter(d => d >= today);
  return candidates.sort()[0];
}

/** The regular trip date that a trip stands in for (itself, unless it was moved). */
export function regularFor(trip: ISODate, schedule: ShopSchedule): ISODate {
  return Object.entries(schedule.moved).find(([, actual]) => actual === trip)?.[0] ?? trip;
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

/**
 * The last day the plan should reach: the end of what the coming trip covers. Planned on
 * Sunday with a Wednesday trip, that is next Tuesday.
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

/**
 * The days the coming trip can move to: today up to the day before the usual trip after it. A
 * later day would land after that trip, so it wouldn't be the coming trip any more.
 */
export function tripMoveChoices(today: ISODate, schedule: ShopSchedule): ISODate[] {
  const trip = nextTrip(today, schedule);
  const following = regularTrip(addDays(regularFor(trip, schedule), 1), schedule.weekday);
  const last = addDays(following, -1);
  return dateRange(today, trip > last ? trip : last);
}

/** When the next trip would be if the coming trip's move were undone. */
export function tripIfUnmoved(today: ISODate, schedule: ShopSchedule): ISODate {
  const { [regularFor(nextTrip(today, schedule), schedule)]: _undone, ...moved } = schedule.moved;
  return nextTrip(today, { ...schedule, moved });
}
