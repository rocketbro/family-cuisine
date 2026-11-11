// A recipe ingredient that matches nothing in the pantry although a pantry name is close to it, so the recipe never counts
// what's in the house. The usual cure is an other name on that item (`alsoCalled`).
import { findPantryItem, nameKey, type PantryItem } from './pantry.ts';
import type { Candidate, TidyInputs } from './tidy-types.ts';

const SHOWN_RECIPES = 3;
const SHOWN_ITEMS = 3;

function editDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

/** Sharing at least half the words of the longer name, or one small slip of spelling. */
export function closeNames(ingredient: string, pantryName: string): boolean {
  const a = nameKey(ingredient);
  const b = nameKey(pantryName);
  const shared = a.filter(word => b.includes(word)).length;
  if (shared && shared / Math.max(a.length, b.length) >= 0.5) return true;
  const [x, y] = [a.join(' '), b.join(' ')];
  return Math.min(x.length, y.length) >= 5 && editDistance(x, y) <= 2;
}

export function unmatchedIngredients({ recipes, pantry }: Pick<TidyInputs, 'recipes' | 'pantry'>): Candidate[] {
  const byName = new Map<string, { written: string; titles: string[]; near: PantryItem[] }>();
  for (const recipe of recipes) {
    for (const { item, optional } of recipe.ingredients) {
      const key = nameKey(item).join(' ');
      if (optional || !key || findPantryItem(item, pantry)) continue;
      const seen = byName.get(key);
      if (seen) { if (!seen.titles.includes(recipe.title)) seen.titles.push(recipe.title); continue; }
      const near = pantry.filter(p => closeNames(item, p.name));
      if (near.length) byName.set(key, { written: item, titles: [recipe.title], near });
    }
  }
  return [...byName.entries()]
    .sort(([, a], [, b]) => b.titles.length - a.titles.length)
    .map(([key, { written, titles, near }]) => {
      const shown = near.slice(0, SHOWN_ITEMS);
      return {
        fingerprint: `ingredient:${key}`,
        kind: 'unmatched_ingredient' as const,
        evidence: [
          `Recipes write "${written}" (${titles.slice(0, SHOWN_RECIPES).join('; ')}${titles.length > SHOWN_RECIPES ? `; and ${titles.length - SHOWN_RECIPES} more` : ''}), and that matches no pantry item.`,
          ...shown.map(p => `Close pantry name: "${p.name}" (${p.status}${p.alsoCalled.length ? `; also called ${p.alsoCalled.join(', ')}` : ''}).`),
        ],
        allowed: ['add_other_name' as const],
        scope: { items: shown.map(({ id, name }) => ({ id, name })), entries: [], statuses: [], names: [written] },
      };
    });
}
