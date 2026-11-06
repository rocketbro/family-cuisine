// A plain, deterministic planner. It runs when no model is configured, and it fills any
// gap the model leaves, so a morning never opens to an empty day.
import { addDays, type ISODate } from './dates.ts';
import { DEFAULT_PORTIONS } from './household.ts';
import { blankEntry, entryKey, portionsMultiplier, type PlanEntry } from './plan.ts';
import type { MealSlot, Recipe } from './recipe.ts';

export type PlannerRecipe = Pick<Recipe, 'slug' | 'meals' | 'kind' | 'batch' | 'serves'>;

export type RotationInput = {
  dates: ISODate[];
  recipes: readonly PlannerRecipe[];
  /** Recent and already-planned entries, used to avoid repeats and to keep the rotation turning. */
  existing: readonly PlanEntry[];
  /** Whether a recipe can go on a date at a batch size (days before shopping need a full pantry). */
  canCook?: (recipe: PlannerRecipe, date: ISODate, multiplier: number) => boolean;
  /** Adult portions a meal should make. */
  portions?: number;
  /** Told about each recipe as it's chosen, so `canCook` can count it against the next. */
  onChoose?: (recipe: PlannerRecipe, date: ISODate, multiplier: number) => void;
};

export function rotationPlan({ dates, recipes, existing, canCook = () => true, portions = DEFAULT_PORTIONS, onChoose }: RotationInput): PlanEntry[] {
  const batch = (recipe: PlannerRecipe) => portionsMultiplier(recipe.serves, portions);
  const taken = new Set(existing.map(entryKey));
  const lastUsed = lastUsedBySlug(existing);
  const planned: PlanEntry[] = [];
  const pick = (slot: MealSlot, date: ISODate) =>
    leastRecent(recipes.filter(r => r.meals.includes(slot) && canCook(r, date, batch(r))), lastUsed, date);

  for (const date of dates) {
    for (const slot of ['breakfast', 'dinner'] as const) {
      if (taken.has(entryKey({ date, slot }))) continue;
      const recipe = pick(slot, date);
      if (!recipe) continue;
      const doubled = slot === 'dinner' && recipe.batch && canCook(recipe, date, batch(recipe) * 2);
      const multiplier = batch(recipe) * (doubled ? 2 : 1);
      planned.push({ ...blankEntry(date, slot), kind: 'recipe', recipeSlug: recipe.slug, multiplier });
      onChoose?.(recipe, date, multiplier);
      taken.add(entryKey({ date, slot }));
      lastUsed.set(recipe.slug, date);

      const nextLunch = { date: addDays(date, 1), slot: 'lunch' as const };
      if (doubled && dates.includes(nextLunch.date) && !taken.has(entryKey(nextLunch))) {
        planned.push({ ...blankEntry(nextLunch.date, 'lunch'), kind: 'leftovers', leftoversOf: { date, slot } });
        taken.add(entryKey(nextLunch));
      }
    }
  }

  for (const date of dates) {
    if (taken.has(entryKey({ date, slot: 'lunch' }))) continue;
    const recipe = pick('lunch', date);
    if (!recipe) continue;
    planned.push({ ...blankEntry(date, 'lunch'), kind: 'recipe', recipeSlug: recipe.slug, multiplier: batch(recipe) });
    onChoose?.(recipe, date, batch(recipe));
    lastUsed.set(recipe.slug, date);
  }
  return planned;
}

function lastUsedBySlug(entries: readonly PlanEntry[]): Map<string, ISODate> {
  const map = new Map<string, ISODate>();
  for (const entry of entries) {
    const slug = entry.outcome === 'swapped' ? entry.outcomeSlug : entry.recipeSlug;
    if (!slug) continue;
    const previous = map.get(slug);
    if (!previous || entry.date > previous) map.set(slug, entry.date);
  }
  return map;
}

/** Never-used first, then the longest-rested; ties break by slug so the result is stable. */
function leastRecent(candidates: readonly PlannerRecipe[], lastUsed: Map<string, ISODate>, today: ISODate): PlannerRecipe | null {
  const sorted = [...candidates].sort((a, b) => {
    const da = lastUsed.get(a.slug) ?? '';
    const db = lastUsed.get(b.slug) ?? '';
    return da === db ? a.slug.localeCompare(b.slug) : da.localeCompare(db);
  });
  const fresh = sorted.find(r => (lastUsed.get(r.slug) ?? '') !== today);
  return fresh ?? sorted[0] ?? null;
}
