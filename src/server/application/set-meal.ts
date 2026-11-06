// A person choosing what goes on the plan.
import type { ISODate } from '../../domain/dates.ts';
import { usesText, type DraftedMeal } from '../../domain/drafted-meal.ts';
import { blankEntry, cookedSlug, leftoversOfRemoved, withoutSource, type PlanEntry } from '../../domain/plan.ts';
import type { MealSlot, Recipe } from '../../domain/recipe.ts';
import type { MealChoice } from '../../shared/api-types.ts';
import { writePick } from './claudes-picks.ts';
import type { Deps } from './deps.ts';
import { batchFor } from './household-profile.ts';
import { UserError } from './user-error.ts';

/** Puts a person's choice on the plan. Leftovers of what was there aren't leftovers of this, so they lose their source. */
function placeMeal(deps: Deps, entry: PlanEntry): void {
  const before = deps.plan.get(entry.date, entry.slot);
  deps.unitOfWork.run(() => {
    deps.plan.upsert(entry);
    if (!before || cookedSlug(before) === cookedSlug(entry)) return;
    for (const leftover of leftoversOfRemoved(deps.plan.range(entry.date, '9999-12-31'), [before])) deps.plan.upsert(withoutSource(leftover));
  });
}

/** A choice with nothing to wait for, so it can be one of several saved together. Clears any outcome, since the plan changed. */
export function placeChoice(deps: Deps, date: ISODate, slot: MealSlot, choice: Exclude<MealChoice, { kind: 'drafted' }>): void {
  const base = blankEntry(date, slot);
  if (choice.kind === 'recipe') {
    const recipe = deps.recipes.get(choice.recipeSlug);
    if (!recipe) throw new UserError('That recipe no longer exists.', 404);
    placeMeal(deps, { ...base, pinned: true, kind: 'recipe', recipeSlug: recipe.slug, multiplier: choice.multiplier ?? batchFor(deps, recipe.serves) });
  } else if (choice.kind === 'leftovers') {
    placeMeal(deps, { ...base, pinned: true, kind: 'leftovers', leftoversOf: choice.leftoversOf });
  } else {
    placeMeal(deps, { ...base, pinned: true, kind: 'note', note: choice.note.trim() || 'Something easy' });
  }
}

/** Swaps what is planned for a meal. */
export async function setMeal(deps: Deps, date: ISODate, slot: MealSlot, choice: MealChoice): Promise<void> {
  const base = blankEntry(date, slot);
  if (choice.kind === 'drafted') {
    const { title, how, uses, multiplier } = choice.draft;
    const recipe = choice.draft.recipeSlug ? deps.recipes.get(choice.draft.recipeSlug) : null;
    if (recipe) {
      // A recipe with something on the side: the side belongs to this meal, not the book.
      placeMeal(deps, { ...base, kind: 'recipe', recipeSlug: recipe.slug, multiplier, pinned: true, drafted: { how, uses } });
      return;
    }
    const pick = await writtenPick(deps, choice.draft, slot);
    placeMeal(deps, pick
      ? { ...base, kind: 'recipe', recipeSlug: pick.slug, multiplier: batchFor(deps, pick.serves), pinned: true, drafted: { how: null, uses } }
      : { ...base, kind: 'note', note: title, pinned: true, drafted: { how, uses } });
  } else {
    placeChoice(deps, date, slot, choice);
  }
}

/** Something rolled that isn't in the book becomes a recipe. If that fails, the meal still stands. */
async function writtenPick(deps: Deps, draft: DraftedMeal, slot: MealSlot): Promise<Recipe | null> {
  const parts = [draft.how, draft.uses.length ? `It uses ${usesText(draft.uses)}.` : null].filter(Boolean);
  try {
    return await writePick(deps, { title: draft.title, idea: parts.join(' ') || null, slot, fromHouse: true });
  } catch (error) {
    deps.log(`couldn't write up ${draft.title}: ${(error as Error).message}`);
    return null;
  }
}
