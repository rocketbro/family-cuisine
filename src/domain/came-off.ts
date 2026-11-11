// A recipe meal someone just replaced. It came off the plan, but the groceries may already be in the
// house, so the screen offers to put it on another day.
import type { ISODate } from './dates.ts';
import type { PlannedDraft } from './drafted-meal.ts';
import { sameDish } from './leftovers.ts';
import { isExtraSlot } from './plan-slot.ts';
import { blankEntry, stillOnlyPlanned, type PlanEntry } from './plan.ts';
import type { MealSlot } from './recipe.ts';

export type CameOffMeal = {
  date: ISODate; slot: MealSlot; title: string; recipeSlug: string; multiplier: number; drafted: PlannedDraft | null;
};

/** `before`, when `after` is a different dish in its place and it's worth moving: a recipe nobody has made yet. */
export function cameOffMeal(before: PlanEntry | null, after: PlanEntry, titleOf: (slug: string) => string | null): CameOffMeal | null {
  if (!before || before.kind !== 'recipe' || !before.recipeSlug || isExtraSlot(before.slot)) return null;
  if (!stillOnlyPlanned(before) || sameDish(before, after)) return null;
  const title = titleOf(before.recipeSlug);
  return title ? { date: before.date, slot: before.slot, title, recipeSlug: before.recipeSlug, multiplier: before.multiplier, drafted: before.drafted } : null;
}

/** The meal as it goes on its new day. A person put it there, so it's pinned. */
export function placedCameOff(meal: CameOffMeal, date: ISODate): PlanEntry {
  return { ...blankEntry(date, meal.slot), kind: 'recipe', recipeSlug: meal.recipeSlug, multiplier: meal.multiplier, drafted: meal.drafted, pinned: true };
}
