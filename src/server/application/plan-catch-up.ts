// When the service comes back: refill what no longer fits, and plan an empty today, as far as the
// household has said the app may plan by itself.
import { addDays, type ISODate } from '../../domain/dates.ts';
import { plansOnItsOwn, tripMorningRuns } from '../../domain/automatic-planning.ts';
import { mealsOnly } from '../../domain/plan-slot.ts';
import { tripWindow } from '../../domain/shop-schedule.ts';
import { automaticPlanning } from './automatic-planning.ts';
import type { Deps } from './deps.ts';
import { planAhead } from './planning.ts';
import { shopSchedule } from './shop-schedule.ts';

/** How many meals a first plan added, or null if today already had one or planning is left to people. */
export async function catchUpPlan(deps: Deps, today: ISODate): Promise<number | null> {
  const choice = automaticPlanning(deps);
  if (!plansOnItsOwn(choice)) return null;
  // An extra on an otherwise empty day still leaves its meals to plan.
  const unplanned = !mealsOnly(deps.plan.range(today, today)).length;
  if (!unplanned) {
    await planAhead(deps, today, null);
    return null;
  }
  const through = tripMorningRuns(choice) ? tripWindow(today, shopSchedule(deps)).end : addDays(today, 1);
  return (await planAhead(deps, today, through)).added;
}
