// The evening check-in: what did you actually eat, and what did it use up?
import { CARRY_OVER_DAYS, carriedMeals, checkinCovers, checkinQuestions, ingredientsUsed, mealsToSettle } from '../../domain/checkin.ts';
import { addDays, type ISODate } from '../../domain/dates.ts';
import { expectedUses, patchAfterUse } from '../../domain/drafted-meal.ts';
import { findPantryItem, statusForCount } from '../../domain/pantry.ts';
import { isExtraSlot } from '../../domain/plan-slot.ts';
import { blankEntry, cookedSlug, type PlanEntry } from '../../domain/plan.ts';
import { batchFor } from './household-profile.ts';
import { portionsAfterCooking } from '../../domain/portion-amounts.ts';
import type { Deps } from './deps.ts';
import { updatePantryItem } from './pantry.ts';
import { planView } from './plan-view.ts';
import type { MealUpdate } from '../../domain/plan.ts';
import type { CheckinView, PantryReport } from '../../shared/api-types.ts';

export function checkinView(deps: Deps, date: ISODate): CheckinView {
  const state = deps.household.checkin(date);
  const meals = planView(deps, date, date);
  const step = !state.mealsDone ? 'meals' : !state.pantryDone ? 'pantry' : 'done';
  if (step !== 'pantry') return { date, step, meals, questions: { counts: [], needs: [], uses: [] }, carried: [] };
  const recipes = new Map(deps.recipes.list().map(r => [r.slug, r]));
  const entries = reachOfCheckin(deps, date);
  return { date, step, meals, questions: checkinQuestions(entries, date, recipes, deps.pantry.list()), carried: carriedMeals(entries, date, recipes) };
}

function reachOfCheckin(deps: Deps, date: ISODate): PlanEntry[] {
  return deps.plan.range(addDays(date, -CARRY_OVER_DAYS), date);
}

/** "We ate what was planned" for every meal of the day. */
export function confirmPlannedMeals(deps: Deps, date: ISODate): void {
  deps.unitOfWork.run(() => {
    for (const entry of deps.plan.range(date, date)) {
      if (!entry.outcome) recordMeal(deps, { date, slot: entry.slot, outcome: 'made', recipeSlug: null, note: null });
    }
    deps.household.markCheckin(date, 'meals');
  });
}

export function recordMeal(deps: Deps, update: MealUpdate): void {
  const found = deps.plan.get(update.date, update.slot);
  if (!found && isExtraSlot(update.slot)) return; // taken off the plan since, and saying its number doesn't make one
  const entry = found ?? blankEntry(update.date, update.slot);
  if (entry.pantrySettled) return; // cook mode's changes are saved, at the size it was made
  const swappedTo = update.outcome === 'swapped' && update.recipeSlug ? deps.recipes.get(update.recipeSlug) : null;
  const sameAsPlanned = swappedTo !== null && entry.kind === 'recipe' && entry.recipeSlug === swappedTo.slug;
  const alreadyRecorded = swappedTo !== null && entry.outcome === 'swapped' && entry.outcomeSlug === swappedTo.slug;
  const next: PlanEntry = {
    ...entry,
    outcome: sameAsPlanned ? 'made' : update.outcome,
    outcomeSlug: sameAsPlanned ? null : swappedTo?.slug ?? null,
    // Something not in the book ("red beans and rice") is kept as a note, so planning knows it was eaten.
    note: update.outcome === 'swapped' && !swappedTo && update.note ? update.note : entry.note,
    // What was cooked instead was cooked at its own size, not the planned dish's. Cook mode knows that size already.
    multiplier: swappedTo && !sameAsPlanned && !alreadyRecorded ? batchFor(deps, swappedTo.serves) : entry.multiplier,
    drafted: entry.drafted && update.uses ? { ...entry.drafted, uses: update.uses } : entry.drafted,
  };
  // Swaps belong to the dish they were chosen for.
  deps.plan.upsert(cookedSlug(next) === cookedSlug(entry) ? next : { ...next, substituted: null });
}

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

/**
 * Settles the day's pantry in one go, with any earlier meals still left to settle. Once it's done, the same
 * report again (a lost response, a second phone) changes nothing, and no later check-in or cook review takes these meals off again.
 */
export function recordPantry(deps: Deps, date: ISODate, report: PantryReport): void {
  deps.unitOfWork.run(() => {
    if (deps.household.checkin(date).pantryDone) return;
    const meals = mealsToSettle(reachOfCheckin(deps, date), date);
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
    deps.household.markCheckin(date, 'pantry');
  });
}
