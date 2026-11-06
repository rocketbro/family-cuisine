// "Done making this": record the meal the moment it's cooked. The pantry changes come later, if
// at all, from the review sheet; until they're saved the evening check-in still settles the meal.
import type { ISODate } from '../../domain/dates.ts';
import { blankEntry, cookedEntry, cookedSlug, slotForHour } from '../../domain/plan.ts';
import type { PlanSlot } from '../../domain/plan-slot.ts';
import type { Substitutions } from '../../domain/substitutes.ts';
import type { CookedMeal } from '../../shared/api-types.ts';
import type { Deps } from './deps.ts';
import { UserError } from './user-error.ts';

export function finishCooking(deps: Deps, input: {
  slug: string; factor: number; today: ISODate; hour: number; date?: ISODate; slot?: PlanSlot;
  substituted?: Substitutions;
}): CookedMeal {
  if (!deps.recipes.get(input.slug)) throw new UserError('That recipe no longer exists.', 404);
  const date = input.date ?? input.today;
  // Opened from a planned meal, that's the one; otherwise today's meal or extra with this recipe, or the meal of the hour.
  const slot = input.slot
    ?? deps.plan.range(date, date).find(e => !e.outcome && cookedSlug(e) === input.slug)?.slot
    ?? slotForHour(input.hour);
  const planned = deps.plan.get(date, slot) ?? blankEntry(date, slot);
  deps.plan.upsert(cookedEntry(planned, input.slug, input.factor, input.substituted ?? null));
  return { date, slot };
}

/** The changes from cooking this meal are saved, so the check-in has nothing left to take off for it. */
export function settleCookedMeal(deps: Deps, date: ISODate, slot: PlanSlot): void {
  const entry = deps.plan.get(date, slot);
  if (entry?.outcome) deps.plan.upsert({ ...entry, pantrySettled: true });
}
