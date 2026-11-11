// The choices made for one trip on the list: what's set aside for finds, how much stocking up, and
// what's ticked, skipped and added by hand.
import type { ISODate } from '../../domain/dates.ts';
import { nextTrip } from '../../domain/shop-schedule.ts';
import type { OneOff } from '../../domain/trip-edits.ts';
import type { Deps } from './deps.ts';
import { shopSchedule } from './shop-schedule.ts';

const KEY = 'trip_plan';

export type TripPlan = {
  trip: ISODate;
  findsCents: number;
  /** Package counts someone set by hand. */
  chosen: Record<string, number>;
  /** Package counts on the list when it was last seen, so a receipt can tell stock from meals. */
  planned: Record<string, number>;
  /** Stock already put away, in the app or from a receipt, so nothing adds it twice. */
  bought: Record<string, number>;
  /** How much of `bought` a receipt has accounted for, so a later receipt doesn't claim it again. */
  matched: Record<string, number>;
  /** Line keys ticked at the store, until they're put away. */
  checked: string[];
  /** Goes up with every change to `checked`, so a phone can tell an old answer from a new one. */
  tickRev: number;
  /** Line keys left off this trip's list and total. */
  skipped: string[];
  /** Things typed onto the list, just for this trip. */
  oneOffs: OneOff[];
};

export function tripPlan(deps: Deps, trip: ISODate): TripPlan {
  // Each trip keeps its own, because a receipt can arrive after the list has moved on to the next one.
  // Before that there was only the one key.
  const saved = deps.household.setting(`${KEY}:${trip}`) ?? deps.household.setting(KEY);
  const plan = saved ? JSON.parse(saved) as Partial<TripPlan> & { trip: ISODate } : null;
  const blank: TripPlan = { trip, findsCents: 0, chosen: {}, planned: {}, bought: {}, matched: {}, checked: [], tickRev: 0, skipped: [], oneOffs: [] };
  return plan?.trip === trip ? { ...blank, ...plan } : blank;
}

export function changeTripPlan(deps: Deps, shopDate: ISODate, change: (plan: TripPlan) => Partial<TripPlan>): void {
  const plan = tripPlan(deps, shopDate);
  deps.household.saveSetting(`${KEY}:${plan.trip}`, JSON.stringify({ ...plan, ...change(plan) }));
}

/** A trip on a different day is the same trip. */
export function moveTripPlan(deps: Deps, from: ISODate, to: ISODate): void {
  const saved = deps.household.setting(`${KEY}:${from}`);
  if (!saved) return;
  deps.household.saveSetting(`${KEY}:${to}`, JSON.stringify({ ...JSON.parse(saved) as TripPlan, trip: to }));
  deps.household.saveSetting(`${KEY}:${from}`, null);
}

export function setFinds(deps: Deps, today: ISODate, cents: number): void {
  changeTripPlan(deps, nextTrip(today, shopSchedule(deps)), () => ({ findsCents: cents }));
}

export function setStockPackages(deps: Deps, today: ISODate, pantryItemId: number, packages: number): void {
  changeTripPlan(deps, nextTrip(today, shopSchedule(deps)), plan => ({ chosen: { ...plan.chosen, [pantryItemId]: packages } }));
}
