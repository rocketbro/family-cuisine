// Finding cheaper weeks: for each meal still to come, what would swapping it take off the list?
// It compares whole lists, because what a meal costs depends on what the others already buy.
import { recipeAvailability } from './availability.ts';
import type { ISODate } from './dates.ts';
import type { PantryItem, Store } from './pantry.ts';
import { isExtraSlot } from './plan-slot.ts';
import type { PlanEntry } from './plan.ts';
import type { MealSlot, Recipe } from './recipe.ts';
import { buildShoppingList, type ShoppingInput, type ShoppingLine } from './shopping.ts';

export type SwapIdea = {
  date: ISODate;
  slot: MealSlot;
  fromTitle: string;
  toSlug: string;
  toTitle: string;
  multiplier: number;
  /** Off the list's known prices. */
  savedCents: number;
  fewerItems: number;
  /** Everything it needs is already in the house. */
  ready: boolean;
};

export type ChosenSwap = Pick<SwapIdea, 'date' | 'slot' | 'toSlug' | 'multiplier'>;

export type SaveMoneyInput = {
  entries: readonly PlanEntry[];
  recipes: ReadonlyMap<string, Recipe>;
  pantry: readonly PantryItem[];
  weekStore: Store;
  from: ISODate;
  to: ISODate;
  today: ISODate;
  productPacks?: ShoppingInput['productPacks'];
  /** What a line costs in all, or null with no price. */
  lineCents: (line: ShoppingLine) => number | null;
  canCook: (recipe: Recipe, date: ISODate, multiplier: number) => boolean;
  multiplierFor: (recipe: Recipe) => number;
};

const MOST_IDEAS = 6;
/** A cheap week still shouldn't be the same dinner every night. */
const MOST_REPEATS = 2;

/** `items` counts packages, so going from three packets to two shows even where the line stays. */
type Cost = { cents: number; items: number; unpriced: Set<string> };

function costOf(input: SaveMoneyInput, entries: readonly PlanEntry[]): Cost {
  const lines = buildShoppingList({ ...input, entries });
  let cents = 0;
  const unpriced = new Set<string>();
  for (const line of lines) {
    const price = input.lineCents(line);
    if (price === null) unpriced.add(line.key);
    else cents += price;
  }
  return { cents, items: lines.reduce((sum, line) => sum + line.packages, 0), unpriced };
}

export function withSwaps(entries: readonly PlanEntry[], swaps: readonly ChosenSwap[]): PlanEntry[] {
  return entries.map(entry => {
    const swap = swaps.find(s => s.date === entry.date && s.slot === entry.slot);
    return swap ? { ...entry, kind: 'recipe' as const, recipeSlug: swap.toSlug, multiplier: swap.multiplier, note: null, leftoversOf: null, drafted: null } : entry;
  });
}

/** What a set of swaps saves together. Ideas share ingredients, so their savings don't simply add up. */
export function savedTogether(input: SaveMoneyInput, swaps: readonly ChosenSwap[]): Pick<SwapIdea, 'savedCents' | 'fewerItems'> {
  const before = costOf(input, input.entries);
  const after = costOf(input, withSwaps(input.entries, swaps));
  return { savedCents: before.cents - after.cents, fewerItems: before.items - after.items };
}

export function swapIdeas(input: SaveMoneyInput): SwapIdea[] {
  const { entries, recipes, today, canCook, multiplierFor, pantry } = input;
  const before = costOf(input, entries);
  const uses = new Map<string, number>();
  for (const entry of entries) if (entry.recipeSlug) uses.set(entry.recipeSlug, (uses.get(entry.recipeSlug) ?? 0) + 1);
  const ideas: SwapIdea[] = [];
  for (const entry of entries) {
    // Extras count towards the list's cost, but someone wants that cake: it's never offered as a swap.
    if (isExtraSlot(entry.slot)) continue;
    const current = recipes.get(entry.recipeSlug ?? '');
    if (entry.kind !== 'recipe' || !current || entry.outcome || entry.date < today) continue;
    let best: SwapIdea | null = null;
    for (const recipe of recipes.values()) {
      // Claude's picks count here: someone looks over each swap before it happens.
      if (recipe.slug === current.slug || !recipe.meals.includes(entry.slot)) continue;
      if ((uses.get(recipe.slug) ?? 0) >= MOST_REPEATS) continue;
      const multiplier = multiplierFor(recipe);
      if (!canCook(recipe, entry.date, multiplier)) continue;
      const after = costOf(input, withSwaps(entries, [{ date: entry.date, slot: entry.slot, toSlug: recipe.slug, multiplier }]));
      // Something new with no price could cost anything, so it can't be called a saving.
      if ([...after.unpriced].some(key => !before.unpriced.has(key))) continue;
      const savedCents = before.cents - after.cents;
      const fewerItems = before.items - after.items;
      if (savedCents < 0 || (savedCents === 0 && fewerItems <= 0)) continue;
      if (best && (savedCents < best.savedCents || (savedCents === best.savedCents && fewerItems <= best.fewerItems))) continue;
      best = {
        date: entry.date, slot: entry.slot, fromTitle: current.title, toSlug: recipe.slug, toTitle: recipe.title, multiplier, savedCents, fewerItems,
        ready: recipeAvailability(recipe.ingredients, pantry, multiplier).level === 'ready',
      };
    }
    if (best) ideas.push(best);
  }
  return ideas.sort((a, b) => b.savedCents - a.savedCents || b.fewerItems - a.fewerItems).slice(0, MOST_IDEAS);
}
