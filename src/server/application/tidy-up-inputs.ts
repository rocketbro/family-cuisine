// Reads everything the tidy-up's checks need, once, through the ports.
import { addDays, type ISODate } from '../../domain/dates.ts';
import type { TidyInputs, TripBuying } from '../../domain/tidy-types.ts';
import { catchUpNoDays } from './checkin-catch-up.ts';
import type { Deps } from './deps.ts';
import { dinnerAnswerDays } from './dinner-left.ts';
import { fridgeSinceDates } from './fridge.ts';
import { mealsOffDates } from './meals-off.ts';
import { standInsForNow } from './stand-ins.ts';

/** Far enough back to see the dinner of any leftovers still to come, and ahead as far as plans go. */
const LOOK_BACK_DAYS = 7;
const LOOK_AHEAD_DAYS = 60;
const TRIPS_LOOKED_AT = 6;

function recentTrips(deps: Deps): TripBuying[] {
  const applied = deps.receipts.list().filter(r => r.status === 'applied');
  return deps.receipts.tripDates().sort().reverse().slice(0, TRIPS_LOOKED_AT).map(shopDate => ({
    shopDate,
    onList: (deps.receipts.tripList(shopDate) ?? []).flatMap(line => line.pantryItemId ?? []),
    bought: applied.filter(r => r.shopDate === shopDate).flatMap(r => r.lines.flatMap(line => line.pantryItemId ?? [])),
  }));
}

export function tidyInputs(deps: Deps, today: ISODate): TidyInputs {
  return {
    today,
    pantry: deps.pantry.list(),
    recipes: deps.recipes.list(),
    recipesTrustworthy: deps.recipes.problems().length === 0,
    plan: deps.plan.range(addDays(today, -LOOK_BACK_DAYS), addDays(today, LOOK_AHEAD_DAYS)),
    standInsForNow: standInsForNow(deps),
    trips: recentTrips(deps),
    mealsOffDates: mealsOffDates(deps),
    catchUpNoDays: catchUpNoDays(deps),
    dinnerAnswerDays: dinnerAnswerDays(deps),
    fridgeSince: fridgeSinceDates(deps),
  };
}
