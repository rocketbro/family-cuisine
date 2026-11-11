// A one-off's price or product, kept with the trip. Asked about any line: only a one-off with no
// pantry item answers, and everything else goes on to the pantry's own price and product.
import { toISODate } from '../../domain/dates.ts';
import { nextTrip } from '../../domain/shop-schedule.ts';
import { itemNamed, oneOffKey, type OneOff } from '../../domain/trip-edits.ts';
import type { Deps } from './deps.ts';
import { shopSchedule } from './shop-schedule.ts';
import { changeTripPlan, tripPlan } from './trip-plan.ts';

export function changeOneOff(
  deps: Deps, line: { pantryItemId: number | null; name: string }, change: Partial<Pick<OneOff, 'cents' | 'walmartItemId'>>,
): boolean {
  if (line.pantryItemId !== null || itemNamed(line.name, deps.pantry.list())) return false;
  const trip = nextTrip(toISODate(new Date()), shopSchedule(deps));
  const key = oneOffKey(line.name);
  if (!tripPlan(deps, trip).oneOffs.some(o => oneOffKey(o.name) === key)) return false;
  changeTripPlan(deps, trip, plan => ({ oneOffs: plan.oneOffs.map(o => (oneOffKey(o.name) === key ? { ...o, ...change } : o)) }));
  return true;
}
