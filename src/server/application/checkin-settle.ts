// Taking a check-in's answers off the pantry for the meals they cover, whether that's the whole day (the
// evening check-in) or one meal checked off on Today.
import { checkinCovers, ingredientsUsed } from '../../domain/checkin.ts';
import type { ISODate } from '../../domain/dates.ts';
import { expectedUses, patchAfterUse } from '../../domain/drafted-meal.ts';
import { findPantryItem, statusForCount } from '../../domain/pantry.ts';
import { portionsAfterCooking } from '../../domain/portion-amounts.ts';
import { cookedSlug, type PlanEntry } from '../../domain/plan.ts';
import type { PantryReport } from '../../shared/api-types.ts';
import type { Deps } from './deps.ts';
import { updatePantryItem } from './pantry.ts';

/** Takes what the meals used off measured portions. Cook mode has already done its own. */
function takeOffPortions(deps: Deps, meals: readonly PlanEntry[]): void {
  for (const entry of meals) {
    const recipe = entry.outcome && !entry.pantrySettled ? deps.recipes.get(cookedSlug(entry) ?? '') : null;
    const settledByUses = new Set(expectedUses(entry).map(use => use.pantryItemId));
    for (const ingredient of recipe ? ingredientsUsed(entry, recipe) : []) {
      if (ingredient.optional) continue;
      const item = findPantryItem(ingredient.item, deps.pantry.list());
      const portions = item && !settledByUses.has(item.id) ? portionsAfterCooking(item.portions, ingredient, entry.multiplier) : [];
      if (item && portions.length) updatePantryItem(deps, item.id, { portions });
    }
  }
}

/** Takes off what drafted meals used, as answered: unanswered ones went as the model expected. */
function takeOffUses(deps: Deps, date: ISODate, meals: readonly PlanEntry[], answers: PantryReport['uses']): void {
  for (const entry of meals) {
    for (const use of expectedUses(entry)) {
      const item = deps.pantry.get(use.pantryItemId);
      const answer = answers.find(a => (a.date ?? date) === entry.date && a.slot === entry.slot && a.pantryItemId === use.pantryItemId)?.answer ?? use.leaves;
      const patch = item && item.status !== 'out' ? patchAfterUse(item, use, answer) : null;
      if (patch) updatePantryItem(deps, use.pantryItemId, patch);
    }
  }
}

/** Applies the answers to these meals and marks them settled. Call it inside a unit of work. */
export function settleMeals(deps: Deps, date: ISODate, meals: readonly PlanEntry[], report: PantryReport): void {
  takeOffPortions(deps, meals);
  takeOffUses(deps, date, meals, report.uses);
  for (const { pantryItemId, used } of report.counts) {
    const item = deps.pantry.get(pantryItemId);
    if (!item || item.count === null || used <= 0) continue;
    const count = Math.max(0, item.count - used);
    updatePantryItem(deps, item.id, { count, status: statusForCount(count) });
  }
  for (const { pantryItemId, answer } of report.needs) {
    updatePantryItem(deps, pantryItemId, { status: answer === 'fine' ? 'have' : answer });
  }
  for (const entry of meals.filter(checkinCovers)) deps.plan.upsert({ ...entry, checkinSettled: true });
}
