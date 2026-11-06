// The Save money sheet: cheaper swaps for this trip's meals, nothing changed until someone confirms.
import { recipeAvailability } from '../../domain/availability.ts';
import { toISODate, type ISODate } from '../../domain/dates.ts';
import { lineCents, packsFromProducts } from '../../domain/prices.ts';
import { batchFor } from './household-profile.ts';
import { savedTogether, swapIdeas, type ChosenSwap, type SaveMoneyInput } from '../../domain/save-money.ts';
import { beforeGroceries, nextTrip, tripCoversThrough } from '../../domain/shop-schedule.ts';
import { inSeason } from '../../domain/seasons.ts';
import type { SaveMoneyView } from '../../shared/api-types.ts';
import type { Deps } from './deps.ts';
import { setMeal } from './set-meal.ts';
import { shopSchedule } from './shop-schedule.ts';
import { DEFAULT_STORE } from './shopping.ts';

function input(deps: Deps, today: ISODate): SaveMoneyInput {
  const schedule = shopSchedule(deps);
  const from = nextTrip(today, schedule);
  const to = tripCoversThrough(from, schedule);
  const pantry = deps.pantry.list();
  const prices = { aldi: deps.prices.forStore('aldi'), walmart: deps.prices.forStore('walmart') };
  const avoided = new Set(deps.avoided.list().map(a => a.title.toLowerCase()));
  const all = deps.recipes.list();
  return {
    entries: deps.plan.range(from, to),
    recipes: new Map(all.map(r => [r.slug, r])),
    pantry, from, to, today,
    productPacks: { aldi: packsFromProducts(prices.aldi), walmart: packsFromProducts(prices.walmart) },
    weekStore: deps.household.storeFor(from) ?? DEFAULT_STORE,
    lineCents: line => {
      const price = line.pantryItemId !== null ? prices[line.store].get(line.pantryItemId) ?? null : null;
      return price && lineCents(line, price);
    },
    canCook: (recipe, date, multiplier) => !avoided.has(recipe.title.toLowerCase()) && inSeason(recipe, date)
      && (!beforeGroceries(date, today, schedule) || recipeAvailability(recipe.ingredients, pantry, multiplier).level === 'ready'),
    multiplierFor: recipe => batchFor(deps, recipe.serves),
  };
}

export function saveMoneyView(deps: Deps): SaveMoneyView {
  const today = toISODate(new Date());
  return { ideas: swapIdeas(input(deps, today)) };
}

export function previewSwaps(deps: Deps, swaps: readonly ChosenSwap[]) {
  return savedTogether(input(deps, toISODate(new Date())), swaps);
}

export async function applySwaps(deps: Deps, swaps: readonly ChosenSwap[]): Promise<void> {
  for (const { date, slot, toSlug, multiplier } of swaps) await setMeal(deps, date, slot, { kind: 'recipe', recipeSlug: toSlug, multiplier });
}
