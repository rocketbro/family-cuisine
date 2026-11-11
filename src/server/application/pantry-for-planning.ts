// The pantry as one planning run sees it: what's in the house, less the meals still to come before
// the groceries, and less each meal the run chooses. The recipe screen's status never goes through
// this; it keeps saying whether that one meal can be made.
import { recipeAvailability } from '../../domain/availability.ts';
import { ingredientsUsed } from '../../domain/checkin.ts';
import type { ISODate } from '../../domain/dates.ts';
import { cookedSlug } from '../../domain/plan.ts';
import type { Recipe } from '../../domain/recipe.ts';
import { pantryAfterMeal } from '../../domain/running-pantry.ts';
import { beforeGroceries, nextTrip } from '../../domain/shop-schedule.ts';
import type { Deps } from './deps.ts';
import { pantryCountingLastTrip } from './pantry-with-trip.ts';
import { shopSchedule } from './shop-schedule.ts';

export function pantryForPlanning(deps: Deps, today: ISODate) {
  const schedule = shopSchedule(deps);
  let pantry = pantryCountingLastTrip(deps, today);

  for (const entry of deps.plan.range(today, nextTrip(today, schedule))) {
    // A settled meal is already out of the pantry.
    const recipe = entry.pantrySettled || entry.checkinSettled ? null : deps.recipes.get(cookedSlug(entry) ?? '');
    if (recipe && beforeGroceries(entry.date, today, schedule)) pantry = pantryAfterMeal(pantry, ingredientsUsed(entry, recipe), entry.multiplier);
  }

  return {
    ready: (recipe: Recipe, multiplier: number) => recipeAvailability(recipe.ingredients, pantry, multiplier).level === 'ready',
    /** Counts a chosen meal. Groceries cover anything from the trip on. */
    take(slug: string, date: ISODate, multiplier: number): void {
      const recipe = deps.recipes.get(slug);
      if (recipe && beforeGroceries(date, today, schedule)) pantry = pantryAfterMeal(pantry, recipe.ingredients, multiplier);
    },
  };
}
