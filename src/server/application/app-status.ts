// What the app asks for first: what this server can do, and the household settings every screen uses.
import { toISODate } from '../../domain/dates.ts';
import type { Status } from '../../shared/api-types.ts';
import type { Deps } from './deps.ts';
import { householdProfile } from './household-profile.ts';
import { shopSchedule } from './shop-schedule.ts';
import { storeLocation } from './store-location.ts';

export function appStatus(deps: Deps): Status {
  return {
    today: toISODate(new Date()),
    ai: deps.ai.available(),
    images: deps.images.available(),
    pushKey: deps.notifier.publicKey(),
    dinnerTime: householdProfile(deps).dinnerTime,
    shopping: shopSchedule(deps),
    storeZip: storeLocation(deps),
  };
}
