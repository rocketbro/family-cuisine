// A person choosing what goes on the plan.
import type { ISODate } from '../../domain/dates.ts';
import type { CameOffMeal } from '../../domain/came-off.ts';
import { usesText, type DraftedMeal } from '../../domain/drafted-meal.ts';
import { madeName } from '../../domain/leftovers.ts';
import { blankEntry } from '../../domain/plan.ts';
import type { MealSlot, Recipe } from '../../domain/recipe.ts';
import type { MealChoice } from '../../shared/api-types.ts';
import { writePick } from './claudes-picks.ts';
import type { Deps } from './deps.ts';
import { batchFor } from './household-profile.ts';
import { placeMeal } from './place-meal.ts';
import { UserError } from './user-error.ts';

/** A choice with nothing to wait for, so it can be one of several saved together. Clears any outcome, since the plan changed. */
export function placeChoice(deps: Deps, date: ISODate, slot: MealSlot, choice: Exclude<MealChoice, { kind: 'drafted' }>): CameOffMeal | null {
  const base = blankEntry(date, slot);
  if (choice.kind === 'recipe') {
    const recipe = deps.recipes.get(choice.recipeSlug);
    if (!recipe) throw new UserError('That recipe no longer exists.', 404);
    return placeMeal(deps, { ...base, pinned: true, kind: 'recipe', recipeSlug: recipe.slug, multiplier: choice.multiplier ?? batchFor(deps, recipe.serves) });
  }
  if (choice.kind === 'leftovers') {
    if (choice.leftoversOf && !wasMade(deps, choice.leftoversOf)) throw new UserError('That meal wasn’t made, so it has no leftovers.', 409);
    return placeMeal(deps, { ...base, pinned: true, kind: 'leftovers', leftoversOf: choice.leftoversOf });
  }
  return placeMeal(deps, { ...base, pinned: true, kind: 'note', note: choice.note.trim() || 'Something easy' });
}

function wasMade(deps: Deps, { date, slot }: { date: ISODate; slot: MealSlot }): boolean {
  const source = deps.plan.get(date, slot);
  return source !== null && madeName(source, slug => deps.recipes.get(slug)?.title ?? null) !== null;
}

/** Swaps what is planned for a meal. Says what came off, when it's a meal someone might want on another day. */
export async function setMeal(deps: Deps, date: ISODate, slot: MealSlot, choice: MealChoice): Promise<CameOffMeal | null> {
  const base = blankEntry(date, slot);
  if (choice.kind === 'drafted') {
    const { title, how, uses, multiplier } = choice.draft;
    const recipe = choice.draft.recipeSlug ? deps.recipes.get(choice.draft.recipeSlug) : null;
    if (recipe) {
      // A recipe with something on the side: the side belongs to this meal, not the book.
      return placeMeal(deps, { ...base, kind: 'recipe', recipeSlug: recipe.slug, multiplier, pinned: true, drafted: { how, uses } });
    }
    const pick = await writtenPick(deps, choice.draft, slot);
    return placeMeal(deps, pick
      ? { ...base, kind: 'recipe', recipeSlug: pick.slug, multiplier: batchFor(deps, pick.serves), pinned: true, drafted: { how: null, uses } }
      : { ...base, kind: 'note', note: title, pinned: true, drafted: { how, uses } });
  }
  return placeChoice(deps, date, slot, choice);
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
