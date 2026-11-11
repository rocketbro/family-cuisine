// What to buy for the coming shopping week, and which store each thing comes from.
import { countable, ingredientStock } from './availability.ts';
import { packagesNeeded, type CartNeed } from './cart-quantity.ts';
import type { ISODate } from './dates.ts';
import type { PackSize } from './pack-size.ts';
import { findPantryItem, standingIn, type PantryItem, type Store } from './pantry.ts';
import { cookedSlug, type PlanEntry } from './plan.ts';
import { shareNeeded } from './portion-amounts.ts';
import type { Recipe } from './recipe.ts';
import { inWalkingOrder, OTHER_SECTION } from './shop-sections.ts';

/** `added`: someone typed it onto this trip's list (`trip-edits.ts`). */
export type ShoppingReason = 'needed' | 'unknown' | 'restock' | 'added';

export type ShoppingLine = {
  key: string;
  name: string;
  /** The pantry item's aisle, or Other with no item. */
  category: string;
  reason: ShoppingReason;
  /** Titles of the planned meals that need it. Empty for plain restocks. */
  neededFor: string[];
  /** For counted items: how many more to buy. */
  quantity: number | null;
  store: Store;
  pantryItemId: number | null;
  walmartItemId: string | null;
  /** How many packages to buy: enough to cover the planned meals, and never fewer than the item's usual. */
  packages: number;
  /** It's needed in amounts, but the product's size isn't known, so this is only the usual quantity. */
  sizeUnknown: boolean;
};

export type ShoppingInput = {
  entries: readonly PlanEntry[];
  recipes: ReadonlyMap<string, Recipe>;
  pantry: readonly PantryItem[];
  weekStore: Store;
  from: ISODate;
  to: ISODate;
  /** Sizes of the products we have prices for, by pantry item (`packsFromProducts`). */
  productPacks?: Partial<Record<Store, ReadonlyMap<number, PackSize>>>;
};

export function buildShoppingList({ entries, recipes, pantry, weekStore, from, to, productPacks = {} }: ShoppingInput): ShoppingLine[] {
  const lines = new Map<string, ShoppingLine>();
  const countNeeded = new Map<string, number>();
  const shareUsed = new Map<string, number>();
  const cartNeeds = new Map<string, CartNeed[]>();

  for (const entry of entries) {
    if (entry.date < from || entry.date > to || entry.outcome) continue;
    const recipe = recipes.get(cookedSlug(entry) ?? '');
    if (!recipe) continue;
    for (const ingredient of recipe.ingredients) {
      if (ingredient.optional) continue;
      const item = findPantryItem(ingredient.item, pantry);
      if (item?.staple) continue;
      const key = item ? `p${item.id}` : `n:${ingredient.item.toLowerCase()}`;
      if (ingredient.amount !== null) {
        const amount = (ingredient.amountMax ?? ingredient.amount) * entry.multiplier;
        cartNeeds.set(key, [...(cartNeeds.get(key) ?? []), { amount, unit: ingredient.unit }]);
      }
      if (item?.count != null && ingredient.amount !== null && countable(ingredient)) {
        countNeeded.set(key, (countNeeded.get(key) ?? 0) + ingredient.amount * entry.multiplier);
      }
      // Portions cover one meal at a time; add up the week's meals too.
      const share = item ? shareNeeded(item.portions, ingredient, entry.multiplier) : null;
      if (share !== null) shareUsed.set(key, (shareUsed.get(key) ?? 0) + share);
      const runsOut = (shareUsed.get(key) ?? 0) > 1;
      const stock = ingredientStock(ingredient, pantry, entry.multiplier);
      const existing = lines.get(key);
      if (existing) {
        if (!existing.neededFor.includes(recipe.title)) existing.neededFor.push(recipe.title);
        continue;
      }
      if (stock === 'have' && item?.count == null && !runsOut) continue;
      lines.set(key, {
        key,
        name: item?.name ?? ingredient.item,
        category: item?.category ?? OTHER_SECTION,
        reason: item ? 'needed' : 'unknown',
        neededFor: [recipe.title],
        quantity: null,
        store: storeFor(item, weekStore),
        pantryItemId: item?.id ?? null,
        walmartItemId: item?.walmartItemId ?? null,
        packages: item?.minPackages ?? 1,
        sizeUnknown: false,
      });
    }
  }

  // Counted items: keep only those where the week's total use outruns the count.
  for (const [key, needed] of countNeeded) {
    const line = lines.get(key);
    const item = pantry.find(p => `p${p.id}` === key);
    if (!line || !item || item.count === null) continue;
    const short = Math.ceil(needed - item.count);
    if (short > 0) line.quantity = short;
    else if (item.status === 'have') lines.delete(key);
  }

  for (const [key, line] of lines) {
    const item = pantry.find(p => `p${p.id}` === key);
    const needs = cartNeeds.get(key);
    const aldi = line.store === 'aldi';
    if (!item || !needs || (!aldi && !item.walmartItemId)) continue;
    // Aldi's own size comes first there. At Walmart, what the product page says beats what a receipt implied.
    const priced = productPacks[line.store]?.get(item.id) ?? null;
    const [first, second] = aldi ? [priced, item.packSize] : [item.packSize, priced];
    const pack = first?.count || first?.measure ? first : second;
    // Amounts kept in portions cover part of what's needed.
    const used = shareUsed.get(key) ?? 0;
    const share = item.status !== 'out' && used > 1 ? (used - 1) / used : 1;
    const packages = packagesNeeded(needs, pack, item.count ?? 0, share);
    line.packages = Math.max(item.minPackages, packages ?? 0);
    line.sizeUnknown = !pack?.count && !pack?.measure && packages === null;
  }

  for (const item of pantry) {
    const key = `p${item.id}`;
    if (item.staple || item.occasional || item.status === 'have' || lines.has(key) || standingIn(item, pantry)) continue;
    lines.set(key, {
      key, name: item.name, category: item.category, reason: 'restock', neededFor: [], quantity: null,
      store: storeFor(item, weekStore), pantryItemId: item.id, walmartItemId: item.walmartItemId, packages: item.minPackages, sizeUnknown: false,
    });
  }
  return inWalkingOrder([...lines.values()]);
}

export function storeFor(item: PantryItem | null, weekStore: Store): Store {
  return item && item.store !== 'any' ? item.store : weekStore;
}
