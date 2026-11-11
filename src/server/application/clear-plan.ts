// Clearing the plan: everything still to come, and nothing that has happened (`domain/plan-clear.ts`).
// The list, the night-before reminder and the planner read the plan afresh. Automatic planning waits until someone plans again.
import type { ISODate } from '../../domain/dates.ts';
import { clearedPlan } from '../../domain/plan-clear.ts';
import { holdAutomaticPlanning } from './automatic-planning.ts';
import type { Deps } from './deps.ts';
import { forgetMealsOff } from './meals-off.ts';

const FOREVER = '9999-12-31';

export function upcomingPlanCount(deps: Deps, today: ISODate): number {
  return clearedPlan(deps.plan.range(today, FOREVER), today).removed.length;
}

/** All of it or none of it. Says how many came off. */
export function clearUpcomingPlan(deps: Deps, today: ISODate): number {
  return deps.unitOfWork.run(() => {
    const { removed, withoutSource } = clearedPlan(deps.plan.range(today, FOREVER), today);
    for (const entry of removed) deps.plan.remove(entry.date, entry.slot);
    for (const entry of withoutSource) deps.plan.upsert(entry);
    if (removed.length) holdAutomaticPlanning(deps);
    forgetMealsOff(deps);
    return removed.length;
  });
}
