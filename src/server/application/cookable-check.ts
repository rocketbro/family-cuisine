import { recipeAvailability } from '../../domain/availability.ts';
import { toISODate, type ISODate } from '../../domain/dates.ts';
import type { Recipe } from '../../domain/recipe.ts';
import { inSeason } from '../../domain/seasons.ts';
import { beforeGroceries } from '../../domain/shop-schedule.ts';
import type { Deps } from './deps.ts';
import { pantryCountingLastTrip } from './pantry-with-trip.ts';
import { shopSchedule } from './shop-schedule.ts';

/**
 * A recipe can go on a date in its season, unless it's before the groceries come and the pantry falls
 * short. By default that's this meal alone, which is what a meal already on the plan is held to.
 * The latest trip's list counts as in the house until that trip is recorded.
 */
export function cookableCheck(deps: Deps, ready?: (recipe: Recipe, multiplier: number) => boolean) {
  const today = toISODate(new Date());
  const pantry = pantryCountingLastTrip(deps, today);
  const schedule = shopSchedule(deps);
  const isReady = ready ?? ((recipe: Recipe, multiplier: number) => recipeAvailability(recipe.ingredients, pantry, multiplier).level === 'ready');
  return (recipe: Pick<Recipe, 'slug'>, date: ISODate, multiplier: number) => {
    const full = deps.recipes.get(recipe.slug);
    if (full === null || !inSeason(full, date)) return false;
    return !beforeGroceries(date, today, schedule) || isReady(full, multiplier);
  };
}
