// The household's own settings, kept with the other household settings under one key.
import { cleanHousehold, householdIsSetUp, readHousehold, type HouseholdProfile } from '../../domain/household.ts';
import { portionsMultiplier } from '../../domain/plan.ts';
import type { HouseholdView } from '../../shared/api-types.ts';
import type { Deps } from './deps.ts';
import { nightBeforeTime } from './night-before-time.ts';

const KEY = 'household_profile';

type Reads = { household: Pick<Deps['household'], 'setting'>; settings: Pick<Deps['settings'], 'dinnerTime'> };

export function householdProfile(deps: Reads): HouseholdProfile {
  return readHousehold(deps.household.setting(KEY), deps.settings.dinnerTime);
}

export function saveHouseholdProfile(deps: Pick<Deps, 'household' | 'settings'>, input: HouseholdProfile): void {
  deps.household.saveSetting(KEY, JSON.stringify(cleanHousehold(input, deps.settings.dinnerTime)));
}

/** The batch multiplier that feeds this household from a recipe serving `serves`. */
export function batchFor(deps: Reads, serves: number): number {
  return portionsMultiplier(serves, householdProfile(deps).portions);
}

export function householdView(deps: Pick<Deps, 'household' | 'settings' | 'storePrices' | 'walmartProducts'>): HouseholdView {
  const profile = householdProfile(deps);
  return {
    profile,
    isSetUp: householdIsSetUp(profile),
    schedule: { ...deps.settings.schedule, nightBeforeTime: nightBeforeTime(deps) },
    lookups: { aldi: deps.storePrices !== null, walmart: deps.walmartProducts !== null },
  };
}
