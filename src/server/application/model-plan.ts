// Turns what the model planned into plan entries: meals from the book, and new dishes written up as recipes.
import { toISODate, type ISODate } from '../../domain/dates.ts';
import { blankEntry, entryKey, type PlanEntry } from '../../domain/plan.ts';
import { plannableMeals, type Recipe } from '../../domain/recipe.ts';
import { isPlausibleModelBatch } from '../../domain/scaling.ts';
import { beforeGroceries } from '../../domain/shop-schedule.ts';
import { writePick } from './claudes-picks.ts';
import type { Deps } from './deps.ts';
import { batchFor } from './household-profile.ts';
import type { PlannedMeal } from './ports/ai.ts';
import { shopSchedule } from './shop-schedule.ts';

/** The most new recipes one planning run writes. */
const NEW_DISHES_PER_PLAN = 4;

/** Keeps only meals that point at real recipes, real dates and open slots. `plannedToCommit` checks leftovers against the rest. */
export function validPlan(deps: Deps, meals: PlannedMeal[], recipes: Recipe[], dates: Set<ISODate>, taken: Set<string>): PlanEntry[] {
  const bySlug = new Map(recipes.map(r => [r.slug, r]));
  const out: PlanEntry[] = [];
  const seen = new Set(taken);
  for (const meal of meals) {
    const key = entryKey(meal);
    if (!dates.has(meal.date) || seen.has(key)) continue;
    const base = blankEntry(meal.date, meal.slot);
    if (meal.kind === 'recipe') {
      const recipe = bySlug.get(meal.recipeSlug ?? '');
      if (!recipe || !plannableMeals(recipe.meals).length) continue;
      const multiplier = isPlausibleModelBatch(meal.multiplier) ? meal.multiplier : batchFor(deps, recipe.serves);
      out.push({ ...base, kind: 'recipe', recipeSlug: recipe.slug, multiplier });
    } else if (meal.kind === 'leftovers' && meal.leftoversOfDate) {
      out.push({ ...base, kind: 'leftovers', leftoversOf: { date: meal.leftoversOfDate, slot: 'dinner' } });
    } else if (meal.kind === 'note' && meal.note) {
      out.push({ ...base, kind: 'note', note: meal.note });
    } else continue;
    seen.add(key);
  }
  return out;
}

/** Writes the recipes for dishes the planner came up with. If one can't be written, the slot keeps its name. */
export async function newDishes(deps: Deps, meals: PlannedMeal[], dates: Set<ISODate>, taken: Set<string>): Promise<PlanEntry[]> {
  const today = toISODate(new Date());
  const schedule = shopSchedule(deps);
  const seen = new Set(taken);
  const wanted = meals.filter(meal => {
    const open = meal.kind === 'new' && meal.note && dates.has(meal.date) && !seen.has(entryKey(meal));
    if (open) seen.add(entryKey(meal));
    return open;
  }).slice(0, NEW_DISHES_PER_PLAN);
  const entries = await Promise.all(wanted.map(async (meal): Promise<PlanEntry | null> => {
    const base = blankEntry(meal.date, meal.slot);
    const fromHouse = beforeGroceries(meal.date, today, schedule);
    try {
      const recipe = await writePick(deps, { title: meal.note!, idea: meal.idea, slot: meal.slot, fromHouse, onlyIfReady: fromHouse });
      return recipe && { ...base, kind: 'recipe', recipeSlug: recipe.slug, multiplier: batchFor(deps, recipe.serves) };
    } catch (error) {
      deps.log(`couldn't write up ${meal.note}: ${(error as Error).message}`);
      return { ...base, kind: 'note', note: meal.note };
    }
  }));
  return entries.filter(e => e !== null);
}
