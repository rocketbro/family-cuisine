// A saved recipe teaches the pantry what it calls things: the names it used for pantry items the
// model matched become those items' other names (`alsoCalled`), for good. A name that already
// stands in for an item just this time (`stand-ins.ts`) is already one of its other names, so it
// is left alone and stays temporary.
import type { Ingredient } from '../../domain/ingredient.ts';
import { matchesInRecipe, newOtherNames, type PantryMatch } from '../../domain/pantry-other-names.ts';
import type { Deps } from './deps.ts';
import { updatePantryItem } from './pantry.ts';

/** `matches` are the model's, so only ones for ingredients this recipe really has are used. */
export function addOtherNames(deps: Deps, matches: readonly PantryMatch[] | undefined, ingredients: readonly Pick<Ingredient, 'item'>[]): void {
  if (!matches?.length) return;
  const real = matchesInRecipe(matches, ingredients.map(i => i.item));
  for (const { itemId, alsoCalled } of newOtherNames(real, deps.pantry.list())) updatePantryItem(deps, itemId, { alsoCalled });
}
