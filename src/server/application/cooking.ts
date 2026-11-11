// A cook review's saved pantry changes settle the meal, so the evening check-in doesn't take them off again.
import type { ISODate } from '../../domain/dates.ts';
import type { PlanSlot } from '../../domain/plan-slot.ts';
import type { Deps } from './deps.ts';

/** The changes from cooking this meal are saved, so the check-in has nothing left to take off for it. */
export function settleCookedMeal(deps: Deps, date: ISODate, slot: PlanSlot): void {
  const entry = deps.plan.get(date, slot);
  if (entry?.outcome) deps.plan.upsert({ ...entry, pantrySettled: true });
}
