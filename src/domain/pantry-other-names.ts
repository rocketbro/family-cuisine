// Recipes call things by other names than the pantry does ("sourdough starter" for the pantry's
// "sourdough discard"). When a recipe is saved with the model's word on which pantry item each
// ingredient is, the written name becomes one of that item's other names, so the next recipe,
// the list and the cookable check all see the two as one without anyone renaming anything.
import { nameKey, type PantryItem } from './pantry.ts';

/** An ingredient as a recipe writes it, and the exact pantry name the model says it is. */
export type PantryMatch = { written: string; pantryName: string };

export type NewOtherNames = { itemId: number; alsoCalled: string[] };

const same = (a: string, b: string) => nameKey(a).join(' ') === nameKey(b).join(' ');
const inside = (name: string, outer: string) => ` ${nameKey(outer).join(' ')} `.includes(` ${nameKey(name).join(' ')} `);

/**
 * The other names to add, one entry per item with its whole new list. A match is ignored when
 * the pantry name is unknown, when the written name already reads as that item (its own name, an
 * other name, or a name with the item's name inside it, like "large eggs" or "celery stalks"),
 * when it offers a choice ("mirin or rice wine"), which isn't one thing's name, or when it is
 * already the name of a different pantry item, which would make two items answer to one word.
 */
export function newOtherNames(matches: readonly PantryMatch[], pantry: readonly PantryItem[]): NewOtherNames[] {
  const added = new Map<number, string[]>();
  for (const { written, pantryName } of matches) {
    const name = written.trim();
    const item = pantry.find(p => same(p.name, pantryName));
    if (!item || !nameKey(name).length) continue;
    const mine = [...item.alsoCalled, ...(added.get(item.id) ?? [])];
    if (same(item.name, name) || mine.some(other => same(other, name))) continue;
    if (inside(item.name, name) || nameKey(name).includes('or')) continue;
    if (pantry.some(other => other.id !== item.id && (same(other.name, name) || other.alsoCalled.some(called => same(called, name))))) continue;
    added.set(item.id, [...(added.get(item.id) ?? []), name]);
  }
  return [...added].map(([itemId, names]) => ({ itemId, alsoCalled: [...pantry.find(p => p.id === itemId)!.alsoCalled, ...names] }));
}

/** Only matches for ingredients the recipe really has, whatever the model reported. */
export function matchesInRecipe(matches: readonly PantryMatch[], ingredientNames: readonly string[]): PantryMatch[] {
  return matches.filter(({ written }) => ingredientNames.some(name => same(name, written)));
}
