// The choices made for one trip on the list: what's set aside for finds, and how much stocking up.
import type { ISODate } from '../../domain/dates.ts';
import { nextTrip } from '../../domain/shop-schedule.ts';
import type { Deps } from './deps.ts';
import { shopSchedule, tripOf } from './shop-schedule.ts';

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
};

export function tripPlan(deps: Deps, shopDate: ISODate): TripPlan {
  const trip = tripOf(deps, shopDate);
  // Each trip keeps its own, because a receipt can arrive after the list has moved on to the next one.
  // Before that there was only the one key.
  const saved = deps.household.setting(`${KEY}:${trip}`) ?? deps.household.setting(KEY);
  const plan = saved ? JSON.parse(saved) as Partial<TripPlan> & { trip: ISODate } : null;
  const blank: TripPlan = { trip, findsCents: 0, chosen: {}, planned: {}, bought: {}, matched: {} };
  return plan?.trip === trip ? { ...blank, ...plan } : blank;
}

export function changeTripPlan(deps: Deps, shopDate: ISODate, change: (plan: TripPlan) => Partial<TripPlan>): void {
  const plan = tripPlan(deps, shopDate);
  deps.household.saveSetting(`${KEY}:${plan.trip}`, JSON.stringify({ ...plan, ...change(plan) }));
}

export function setFinds(deps: Deps, today: ISODate, cents: number): void {
  changeTripPlan(deps, nextTrip(today, shopSchedule(deps)), () => ({ findsCents: cents }));
}

export function setStockPackages(deps: Deps, today: ISODate, pantryItemId: number, packages: number): void {
  changeTripPlan(deps, nextTrip(today, shopSchedule(deps)), plan => ({ chosen: { ...plan.chosen, [pantryItemId]: packages } }));
}
