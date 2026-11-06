// The shopping day: a regular weekday, and this week's trip moved when life happens.
// Changing either re-checks the plan, since the days before groceries only get ready meals.
import { addDays, type ISODate } from '../../domain/dates.ts';
import { nextTrip, planHorizonEnd, regularFor, regularTrip } from '../../domain/shop-schedule.ts';
import type { Deps } from './deps.ts';
import { replanAfterChange } from './planning.ts';
import { saveShopWeekday, shopSchedule } from './shop-schedule.ts';
import { UserError } from './user-error.ts';

export async function setShopWeekday(deps: Deps, today: ISODate, weekday: number): Promise<void> {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new UserError('Pick a day of the week.');
  saveShopWeekday(deps, weekday);
  await replan(deps, today);
}

/** Moves only the coming trip. `actual` null puts it back on the regular day. */
export async function moveNextTrip(deps: Deps, today: ISODate, actual: ISODate | null): Promise<void> {
  const schedule = shopSchedule(deps);
  const regular = regularFor(nextTrip(today, schedule), schedule);
  if (actual !== null) {
    const following = regularTrip(addDays(regular, 1), schedule.weekday);
    if (actual < today || actual >= addDays(following, 7)) throw new UserError('Pick a day between today and the week after.');
  }
  // The store choice for the trip follows it to its new day.
  const store = deps.household.storeFor(nextTrip(today, schedule));
  deps.household.moveTrip(regular, actual);
  if (store) deps.household.setStore(nextTrip(today, shopSchedule(deps)), store);
  await replan(deps, today);
}

async function replan(deps: Deps, today: ISODate): Promise<void> {
  await replanAfterChange(deps, today, planHorizonEnd(today, shopSchedule(deps)));
}
