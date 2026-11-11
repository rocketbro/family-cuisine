// The household's shopping schedule as the use cases see it: the trips on record. With none yet,
// the .env weekday starts the weekly rhythm.
import { addDays, dayOfWeek } from '../../domain/dates.ts';
import type { ShopSchedule } from '../../domain/shop-schedule.ts';
import type { Deps } from './deps.ts';

const ANY_WEEK = '2026-01-04';

export function shopSchedule(deps: Pick<Deps, 'household' | 'settings'>): ShopSchedule {
  const trips = deps.household.shopTrips();
  return { trips: trips.length ? trips : [addDays(ANY_WEEK, (deps.settings.shopWeekday - dayOfWeek(ANY_WEEK) + 7) % 7)] };
}
