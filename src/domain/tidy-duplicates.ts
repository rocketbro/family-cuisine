// Two pantry items that may be one thing: "chicken thighs" and "boneless skinless chicken thighs".
import { findPantryItem, nameKey, type PantryItem } from './pantry.ts';
import type { Candidate, TidyInputs } from './tidy-types.ts';

/** The shorter name is the end of the longer one, or they read the same. */
export function looksLikeSame(a: string, b: string): boolean {
  const [short, long] = [nameKey(a), nameKey(b)].sort((x, y) => x.length - y.length);
  if (!short.length) return false;
  return short.every((word, i) => long[long.length - short.length + i] === word);
}

const describe = (item: PantryItem, recipesUsing: number) => {
  const bits = [item.status, item.count !== null ? `count ${item.count}` : null, item.useBy ? `use by ${item.useBy}` : null, item.alsoCalled.length ? `also called ${item.alsoCalled.join(', ')}` : null, `${item.category}`, recipesUsing ? `in ${recipesUsing} recipe${recipesUsing === 1 ? '' : 's'}` : 'in no recipe'];
  return `"${item.name}": ${bits.filter(Boolean).join('; ')}`;
};

export function likelyDuplicates({ pantry, recipes }: Pick<TidyInputs, 'pantry' | 'recipes'>): Candidate[] {
  const used = new Map<number, number>();
  for (const recipe of recipes) {
    const ids = new Set(recipe.ingredients.flatMap(i => findPantryItem(i.item, pantry)?.id ?? []));
    for (const id of ids) used.set(id, (used.get(id) ?? 0) + 1);
  }
  const found: Candidate[] = [];
  pantry.forEach((a, i) => {
    for (const b of pantry.slice(i + 1)) {
      if (a.category !== b.category || !looksLikeSame(a.name, b.name)) continue;
      // Kept in portions or not, two items' amounts can't be added up for the person.
      const merge = !a.portions.length && !b.portions.length;
      found.push({
        fingerprint: `duplicate:${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}`,
        kind: 'duplicate_items',
        evidence: [describe(a, used.get(a.id) ?? 0), describe(b, used.get(b.id) ?? 0), 'Same category, and one name is the end of the other.'],
        allowed: merge ? ['merge_items', 'add_other_name'] : ['add_other_name'],
        scope: { items: [a, b].map(({ id, name }) => ({ id, name })), entries: [], statuses: [], names: [a.name, b.name] },
      });
    }
  });
  return found;
}
