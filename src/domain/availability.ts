// "Can we make this right now?" A recipe reads as ready, mostly there, or a shopping trip.
import type { Ingredient } from './ingredient.ts';
import { findPantryItem, type PantryItem } from './pantry.ts';
import { shareNeeded } from './portion-amounts.ts';

/** `low`: enough for this batch, but running low. `short`: known amounts say this batch needs more than there is. */
export type IngredientStock = 'have' | 'low' | 'short' | 'missing' | 'staple';
export type AvailabilityLevel = 'ready' | 'most' | 'missing';

export type Availability = {
  level: AvailabilityLevel;
  missing: string[];
  /** Some in the house, but not enough for this batch. */
  short: string[];
  low: string[];
};

export function ingredientStock(ingredient: Ingredient, pantry: readonly PantryItem[], factor = 1): IngredientStock {
  const item = findPantryItem(ingredient.item, pantry);
  if (!item) return 'missing';
  if (item.staple) return 'staple';
  const share = shareNeeded(item.portions, ingredient, factor);
  if (share !== null) return share > 1 ? 'short' : item.status === 'low' ? 'low' : 'have';
  if (item.count !== null && ingredient.amount !== null && countable(ingredient)) {
    const needed = ingredient.amount * factor;
    if (item.count < needed) return item.count > 0 ? 'short' : 'missing';
    return item.status === 'low' ? 'low' : 'have';
  }
  return item.status === 'out' ? 'missing' : item.status;
}

/** Counts compare only when the recipe also counts ("3 eggs", not "1 cup eggs"). */
export function countable(ingredient: Ingredient): boolean {
  return ingredient.unit === null || ingredient.unit === 'can' || ingredient.unit === 'package';
}

export function recipeAvailability(ingredients: readonly Ingredient[], pantry: readonly PantryItem[], factor = 1): Availability {
  const missing: string[] = [];
  const short: string[] = [];
  const low: string[] = [];
  let considered = 0;
  for (const ingredient of ingredients) {
    if (ingredient.optional) continue;
    const stock = ingredientStock(ingredient, pantry, factor);
    if (stock === 'staple') continue;
    considered += 1;
    const name = findPantryItem(ingredient.item, pantry)?.name ?? ingredient.item;
    if (stock === 'missing') missing.push(name);
    if (stock === 'short') short.push(name);
    if (stock === 'low') low.push(name);
  }
  return { level: levelFor(missing.length + short.length, considered), missing, short, low };
}

/** Missing or short on one or two of many is "most"; a third or more is a trip to the store. */
export function levelFor(gaps: number, considered: number): AvailabilityLevel {
  if (gaps === 0) return 'ready';
  if (gaps <= 2 && gaps / Math.max(considered, 1) < 0.34) return 'most';
  return 'missing';
}
