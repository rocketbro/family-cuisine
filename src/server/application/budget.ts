// What we can spend on food this trip, whichever store it's at.
import type { Deps } from './deps.ts';

const BUDGET_KEY = 'trip_budget_cents';

export function tripBudget(deps: Deps): number | null {
  const saved = deps.household.setting(BUDGET_KEY);
  return saved === null ? null : Number(saved);
}

export function setTripBudget(deps: Deps, cents: number | null): void {
  deps.household.saveSetting(BUDGET_KEY, cents === null ? null : String(Math.round(cents)));
}
