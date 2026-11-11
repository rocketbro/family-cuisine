// What's been ticked on a trip's list, saved as people go so it survives a reload and two phones
// see the same list. Each tap changes one line, and the server's handling never waits, so two
// people can't overwrite each other. Put away is separate and still does the pantry's work.
import type { ISODate } from '../../domain/dates.ts';
import { nextTrip } from '../../domain/shop-schedule.ts';
import type { TripTicks } from '../../shared/api-types.ts';
import type { Deps } from './deps.ts';
import { shopSchedule } from './shop-schedule.ts';
import { changeTripPlan, tripPlan, type TripPlan } from './trip-plan.ts';

/**
 * Says what a line should be, not to flip it, so a retry can't undo itself. A tap that arrives after
 * its trip is over (the phone was offline) is dropped rather than ticking next week's list.
 */
export function setTick(deps: Deps, today: ISODate, trip: ISODate, key: string, checked: boolean): TripTicks {
  const current = nextTrip(today, shopSchedule(deps));
  if (trip === current) {
    changeTripPlan(deps, trip, plan => {
      const others = plan.checked.filter(k => k !== key);
      return { checked: checked ? [...others, key] : others, tickRev: plan.tickRev + 1 };
    });
  }
  const { checked: ticked, tickRev } = tripPlan(deps, current);
  return { checked: ticked, rev: tickRev };
}

/** The change that takes lines off the ticked set. */
export function withoutTicks(plan: TripPlan, keys: readonly string[]): Pick<TripPlan, 'checked' | 'tickRev'> {
  return { checked: plan.checked.filter(k => !keys.includes(k)), tickRev: plan.tickRev + 1 };
}
