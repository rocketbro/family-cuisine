// Changing a recipe by hand, and what taking one out of the book does to the plan.
import { formatIngredientLine, parseIngredientLine, type Ingredient } from './ingredient.ts';
import { cookedSlug, leftoversOfRemoved, type PlanEntry } from './plan.ts';
import { groupIngredients, type Recipe } from './recipe.ts';

/** `nightBefore` left out means it stays as it is; null takes it off. */
export type RecipeEdit = Pick<Recipe, 'title' | 'meals' | 'serves' | 'time' | 'summary' | 'ingredients' | 'body'> & { nightBefore?: string | null };

/** One ingredient per line, with a "For the sauce:" line above each group. */
export function ingredientsToText(ingredients: readonly Ingredient[]): string {
  return groupIngredients(ingredients).flatMap(({ group, items }) => [
    ...(group ? [`${group}:`] : []),
    ...items.map(item => formatIngredientLine(item).replace(/^- /, '')),
  ]).join('\n');
}

export function ingredientsFromText(text: string): Ingredient[] {
  const ingredients: Ingredient[] = [];
  let group: string | null = null;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.endsWith(':')) {
      group = trimmed.slice(0, -1).trim() || null;
      continue;
    }
    const parsed = parseIngredientLine(trimmed, group);
    if (parsed) ingredients.push(parsed);
  }
  return ingredients;
}

/** Whatever follows the ingredients has to start with a heading, or it would read as more ingredients. */
export function bodyWithHeading(body: string): string {
  const trimmed = body.trim();
  return !trimmed || /^##\s/.test(trimmed) ? trimmed : `## Steps\n${trimmed}`;
}

/**
 * What the plan looks like without a recipe. Meals nobody has eaten yet come off, along with
 * any leftovers of them. Meals already recorded keep the title as a note, so the history still reads.
 */
export function planWithoutRecipe(entries: readonly PlanEntry[], slug: string, title: string): { removed: PlanEntry[]; renamed: PlanEntry[] } {
  const removed = entries.filter(e => !e.outcome && e.kind === 'recipe' && e.recipeSlug === slug);
  const leftovers = leftoversOfRemoved(entries, removed);
  const renamed = entries.filter(e => e.outcome && (cookedSlug(e) === slug || (e.outcome === 'skipped' && e.recipeSlug === slug))).map(e => ({
    ...e,
    kind: 'note' as const,
    recipeSlug: null,
    outcomeSlug: null,
    note: title,
    outcome: e.outcome === 'skipped' ? ('skipped' as const) : ('made' as const),
  }));
  return { removed: [...removed, ...leftovers], renamed };
}
