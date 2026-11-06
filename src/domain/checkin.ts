// The evening check-in turns "what did you make?" into pantry updates with as few taps as
// possible: counted items get a "how many did you use?", and up to five other things used
// today get a quick "do we need more?". It also picks up earlier meals that were cooked with
// nothing left to catch them: after that day's check-in, or on a day that never had one.
import type { ISODate } from './dates.ts';
import { countable } from './availability.ts';
import { expectedUses, type UseAnswer } from './drafted-meal.ts';
import { findPantryItem, type PantryItem } from './pantry.ts';
import { isExtraSlot, type PlanSlot } from './plan-slot.ts';
import { cookedSlug, type PlanEntry } from './plan.ts';
import type { Recipe } from './recipe.ts';
import { applySubstitutions } from './substitutes.ts';

export const MAX_NEED_QUESTIONS = 5;
/** How far back a check-in looks. Past this, the pantry has moved on and nobody remembers the meal. */
export const CARRY_OVER_DAYS = 7;

export type CountQuestion = { pantryItemId: number; name: string; estimate: number; onHand: number };
export type NeedQuestion = { pantryItemId: number; name: string; usedIn: string };

/** One thing a drafted meal expected to use, answered ahead of time with what the model expected. */
export type UseQuestion = { date: ISODate; slot: PlanSlot; pantryItemId: number; name: string; text: string; answer: UseAnswer };

export type CheckinQuestions = { counts: CountQuestion[]; needs: NeedQuestion[]; uses: UseQuestion[] };

/** An earlier meal this check-in also covers. */
export type CarriedMeal = { date: ISODate; slot: PlanSlot; title: string };

/** A check-in has something to say about this meal: it was cooked, or a drafted meal's uses are due. */
export function checkinCovers(entry: PlanEntry): boolean {
  return entry.outcome !== null && (cookedSlug(entry) !== null || expectedUses(entry).length > 0);
}

/** The meal still has pantry to take off: no check-in has been through it, and a saved review only covers the recipe. */
function leftToSettle(entry: PlanEntry): boolean {
  if (entry.checkinSettled || !checkinCovers(entry)) return false;
  return !entry.pantrySettled || expectedUses(entry).length > 0;
}

/** What a check-in for this date goes through: that day's meals, and earlier ones still left to settle. */
export function mealsToSettle(entries: readonly PlanEntry[], date: ISODate): PlanEntry[] {
  return entries.filter(e => !e.checkinSettled && (e.date === date || (e.date < date && leftToSettle(e))));
}

export function carriedMeals(entries: readonly PlanEntry[], date: ISODate, recipes: ReadonlyMap<string, Recipe>): CarriedMeal[] {
  return mealsToSettle(entries, date).filter(e => e.date !== date).map(e => ({
    date: e.date, slot: e.slot, title: recipes.get(cookedSlug(e) ?? '')?.title ?? e.note ?? 'A meal',
  }));
}

/** What the meal really used: the recipe with the swaps chosen when it was cooked. */
export function ingredientsUsed(entry: Pick<PlanEntry, 'substituted'>, recipe: Pick<Recipe, 'ingredients'>): Recipe['ingredients'] {
  return applySubstitutions(recipe.ingredients, entry.substituted ?? {});
}

export function checkinQuestions(
  entries: readonly PlanEntry[], date: ISODate, recipes: ReadonlyMap<string, Recipe>, pantry: readonly PantryItem[],
): CheckinQuestions {
  const counts = new Map<number, CountQuestion>();
  const needs = new Map<number, NeedQuestion & { weight: number }>();
  const uses: UseQuestion[] = [];
  const meals = mealsToSettle(entries, date);
  for (const entry of meals) {
    for (const use of expectedUses(entry)) {
      const item = pantry.find(p => p.id === use.pantryItemId);
      if (item && item.status !== 'out') uses.push({ date: entry.date, slot: entry.slot, pantryItemId: item.id, name: item.name, text: use.text, answer: use.leaves });
    }
  }
  const asked = new Set(uses.map(u => u.pantryItemId));

  for (const entry of meals) {
    // Cook mode already updated the pantry for this meal; don't ask about it twice.
    if (entry.pantrySettled) continue;
    // An extra nobody says they made may well still be coming, and asking now would take it off twice.
    if (isExtraSlot(entry.slot) && !entry.outcome) continue;
    const recipe = recipes.get(cookedSlug(entry) ?? '');
    if (!recipe) continue;
    for (const ingredient of ingredientsUsed(entry, recipe)) {
      const item = findPantryItem(ingredient.item, pantry);
      if (!item || item.staple || asked.has(item.id)) continue;
      // Measured portions are taken down when the check-in is saved; nothing to ask.
      if (item.portions.length) continue;
      if (item.count !== null) {
        const used = ingredient.amount !== null && countable(ingredient) ? ingredient.amount * entry.multiplier : 0;
        const existing = counts.get(item.id);
        if (existing) existing.estimate += used;
        else counts.set(item.id, { pantryItemId: item.id, name: item.name, estimate: used, onHand: item.count });
        continue;
      }
      if (item.status === 'out' || ingredient.optional) continue;
      // Ask first about what was already low, then about what the meal used the most of.
      const weight = (item.status === 'low' ? 100 : 0) + (ingredient.amount ?? 1) * entry.multiplier;
      const existing = needs.get(item.id);
      if (!existing || existing.weight < weight) needs.set(item.id, { pantryItemId: item.id, name: item.name, usedIn: recipe.title, weight });
    }
  }

  const needList = [...needs.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_NEED_QUESTIONS)
    .map(({ weight: _weight, ...question }) => question);
  const countList = [...counts.values()].map(q => ({ ...q, estimate: Math.min(q.onHand, Math.round(q.estimate)) }));
  return { counts: countList, needs: needList, uses };
}
