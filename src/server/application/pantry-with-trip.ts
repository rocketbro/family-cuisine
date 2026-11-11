// What planning counts as in the house: the pantry, plus the list of the latest trip until that trip
// is recorded (`domain/trip-in-house.ts`).
import type { ISODate } from '../../domain/dates.ts';
import type { PantryItem } from '../../domain/pantry.ts';
import { latestTripGone, pantryWithTripList, tripRecorded } from '../../domain/trip-in-house.ts';
import type { Deps } from './deps.ts';
import { shopSchedule } from './shop-schedule.ts';
import { tripPlan } from './trip-plan.ts';

export function pantryCountingLastTrip(deps: Deps, today: ISODate): PantryItem[] {
  const pantry = deps.pantry.list();
  const trip = latestTripGone(today, shopSchedule(deps));
  const list = trip && deps.receipts.tripList(trip);
  if (!trip || !list || tripRecorded(trip, list, tripPlan(deps, trip).bought, deps.receipts.list())) return pantry;
  return pantryWithTripList(pantry, list);
}
