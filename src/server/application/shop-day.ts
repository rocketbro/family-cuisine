// Choosing when a trip happens. What's kept for the trip goes with it, and the plan is re-checked,
// since the days before groceries only get ready meals.
import { addDays, type ISODate } from '../../domain/dates.ts';
import { plansOnItsOwn, tripMorningRuns } from '../../domain/automatic-planning.ts';
import { nextTrip, tripWindow, withTripMoved } from '../../domain/shop-schedule.ts';
import { automaticPlanning } from './automatic-planning.ts';
import type { Deps } from './deps.ts';
import { replanAfterChange } from './planning.ts';
import { shopSchedule } from './shop-schedule.ts';
import { moveTripPlan } from './trip-plan.ts';
import { UserError } from './user-error.ts';
import { moveSentToCart } from './walmart-cart.ts';

/** How far ahead a trip can be put, so a mistyped year doesn't empty the calendar. */
const FARTHEST_DAYS = 8 * 7;

export async function moveTrip(deps: Deps, today: ISODate, from: ISODate, to: ISODate): Promise<void> {
  const schedule = shopSchedule(deps);
  if (nextTrip(from, schedule) !== from || from < tripWindow(today, schedule).start) throw new UserError('That trip isn’t on the calendar any more.', 409);
  if (to === from) return;
  if (to < today) throw new UserError('Pick today or a day ahead.');
  if (to > addDays(today, FARTHEST_DAYS)) throw new UserError('Pick a day in the next eight weeks.');
  if (to <= tripWindow(addDays(from, -1), schedule).start) throw new UserError('Pick a day after the trip before it.');
  deps.unitOfWork.run(() => {
    const store = deps.household.storeFor(from);
    if (store) deps.household.setStore(to, store);
    const list = deps.receipts.tripList(from);
    if (list && !deps.receipts.tripList(to)) deps.receipts.saveTripList(to, list);
    moveTripPlan(deps, from, to);
    moveSentToCart(deps, from, to);
    deps.household.saveShopTrips(withTripMoved(deps.household.shopTrips(), from, to));
  });
  await replan(deps, today);
}

/** Moving a trip later opens up days, which the app fills if it plans on grocery mornings. */
async function replan(deps: Deps, today: ISODate): Promise<void> {
  const choice = automaticPlanning(deps);
  if (!plansOnItsOwn(choice)) return;
  await replanAfterChange(deps, today, tripMorningRuns(choice) ? tripWindow(today, shopSchedule(deps)).end : today);
}
