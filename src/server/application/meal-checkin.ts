// Checking one meal off on Today asks about just that meal: the same questions the evening check-in would
// have, answered through the same settling, so the check-in has nothing left to ask about it.
import { checkinQuestions } from '../../domain/checkin.ts';
import type { ISODate } from '../../domain/dates.ts';
import { asksAnyLeft } from '../../domain/dinner-left.ts';
import type { PlanSlot } from '../../domain/plan-slot.ts';
import type { MealQuestions, PantryReport } from '../../shared/api-types.ts';
import { settleMeals } from './checkin-settle.ts';
import type { Deps } from './deps.ts';
import { dinnersLeft } from './dinner-left.ts';
import { UserError } from './user-error.ts';

function checkedOff(deps: Deps, date: ISODate, slot: PlanSlot) {
  const entry = deps.plan.get(date, slot);
  if (!entry?.outcome) throw new UserError('That meal hasn’t been marked as eaten.', 409);
  return entry;
}

export function mealQuestions(deps: Deps, date: ISODate, slot: PlanSlot): MealQuestions {
  const entry = checkedOff(deps, date, slot);
  const recipes = new Map(deps.recipes.list().map(r => [r.slug, r]));
  return {
    questions: checkinQuestions([entry], date, recipes, deps.pantry.list()),
    anyLeft: asksAnyLeft([entry]) ? { answer: dinnersLeft(deps)[date] ?? null } : null,
  };
}

/** Once a meal is settled the same answers again change nothing, like the day's report. */
export function settleMeal(deps: Deps, date: ISODate, slot: PlanSlot, report: PantryReport): void {
  deps.unitOfWork.run(() => {
    const entry = checkedOff(deps, date, slot);
    if (entry.checkinSettled) return;
    settleMeals(deps, date, [entry], report);
  });
}
