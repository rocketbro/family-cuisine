import { recipeAvailability } from '../../domain/availability.ts';
import { addDays, type ISODate } from '../../domain/dates.ts';
import { whyItCameOff, type MealOff } from '../../domain/meal-off.ts';
import { leftoversOfRemoved, withoutSource, type PlanEntry } from '../../domain/plan.ts';
import { isExtraSlot } from '../../domain/plan-slot.ts';
import type { Recipe } from '../../domain/recipe.ts';
import { inSeason } from '../../domain/seasons.ts';
import { cookableCheck } from './cookable-check.ts';
import type { Deps } from './deps.ts';
import { rememberMealsOff } from './meals-off.ts';
import { pantryCountingLastTrip } from './pantry-with-trip.ts';

/**
 * Takes off planner-chosen meals that can no longer be cooked before the groceries come (the pantry
 * changed since they were planned), and their leftovers, for the planning run to refill, and remembers
 * them so people get told. Meals someone chose themselves are never replaced, even leftovers: those
 * stay, as plain leftovers with no source.
 */
export function keepPlanCookable(deps: Deps, today: ISODate): PlanEntry[] {
  const recipes = new Map(deps.recipes.list().map(r => [r.slug, r]));
  const canCook = cookableCheck(deps);
  const ahead = deps.plan.range(today, '9999-12-31');
  const stale = ahead.filter(e => e.date <= addDays(today, 7)).filter(e => {
    const recipe = e.kind === 'recipe' && !e.outcome && !e.pinned ? recipes.get(e.recipeSlug ?? '') : null;
    return recipe && !canCook(recipe, e.date, e.multiplier);
  });
  const leftovers = leftoversOfRemoved(ahead, stale);
  const removed = [...stale, ...leftovers.filter(e => !e.pinned)];
  const offs = mealsOff(deps, today, stale, recipes);
  deps.unitOfWork.run(() => {
    for (const entry of removed) deps.plan.remove(entry.date, entry.slot);
    for (const entry of leftovers.filter(e => e.pinned)) deps.plan.upsert(withoutSource(entry));
    rememberMealsOff(deps, today, offs);
  });
  return removed;
}

function mealsOff(deps: Deps, today: ISODate, stale: readonly PlanEntry[], recipes: ReadonlyMap<string, Recipe>): MealOff[] {
  if (!stale.length) return [];
  const pantry = pantryCountingLastTrip(deps, today);
  return stale.flatMap(entry => {
    const recipe = recipes.get(entry.recipeSlug ?? '');
    if (!recipe || isExtraSlot(entry.slot)) return [];
    return [{
      date: entry.date, slot: entry.slot, title: recipe.title, recipeSlug: recipe.slug, multiplier: entry.multiplier,
      why: whyItCameOff(recipeAvailability(recipe.ingredients, pantry, entry.multiplier), inSeason(recipe, entry.date)), told: false,
    }];
  });
}
