// Small changes to a meal already on the plan.
import type { ISODate } from '../../domain/dates.ts';
import { withMealDone } from '../../domain/plan.ts';
import type { PlanSlot } from '../../domain/plan-slot.ts';
import type { Deps } from './deps.ts';
import { sizeWithoutSwap } from './planned-size.ts';
import { UserError } from './user-error.ts';

export function setMealDone(deps: Deps, date: ISODate, slot: PlanSlot, done: boolean): void {
  const entry = deps.plan.get(date, slot);
  if (!entry) throw new UserError('Nothing is planned for that meal.', 404);
  // Unticking a swap puts the planned dish back, at its own size.
  deps.plan.upsert({ ...withMealDone(entry, done), multiplier: done ? entry.multiplier : sizeWithoutSwap(deps, entry) });
}

export function setMultiplier(deps: Deps, date: ISODate, slot: PlanSlot, multiplier: number): void {
  const entry = deps.plan.get(date, slot);
  if (entry && multiplier > 0) deps.plan.upsert({ ...entry, multiplier });
}
