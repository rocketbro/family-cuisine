// What people changed about one trip's list by hand: lines skipped, things added just for this
// trip. The list is still worked out fresh each time; these go on top of it.
import { nameKey, type PantryItem, type Store } from './pantry.ts';
import { lineCents, type Price } from './prices.ts';
import { OTHER_SECTION } from './shop-sections.ts';
import { storeFor, type ShoppingLine } from './shopping.ts';

/** Something typed onto one trip's list. Its price and product stay here, so it never needs a pantry item. */
export type OneOff = { name: string; cents: number | null; walmartItemId: string | null };

const ONE_OFF = 'o:';

const sameWords = (a: string, b: string) => nameKey(a).join(' ') === nameKey(b).join(' ');

/** By its words, so adding it twice, or a retry after a lost answer, is still one line. */
export function oneOffKey(name: string): string {
  return `${ONE_OFF}${nameKey(name).join(' ')}`;
}

export function isOneOffKey(key: string): boolean {
  return key.startsWith(ONE_OFF);
}

/** Only an item with the same name. A looser match would turn "milk" into "oat milk". */
export function itemNamed(name: string, pantry: readonly PantryItem[]): PantryItem | null {
  return pantry.find(item => sameWords(item.name, name)) ?? null;
}

export function sameThing(line: Pick<ShoppingLine, 'name' | 'pantryItemId'>, name: string, item: PantryItem | null): boolean {
  return item ? line.pantryItemId === item.id : sameWords(line.name, name);
}

/** Lines for what's been added. One the list has since come to need on its own isn't shown twice. */
export function oneOffLines(oneOffs: readonly OneOff[], list: readonly ShoppingLine[], pantry: readonly PantryItem[], weekStore: Store): ShoppingLine[] {
  return oneOffs.flatMap(oneOff => {
    const item = itemNamed(oneOff.name, pantry);
    if (list.some(line => sameThing(line, oneOff.name, item))) return [];
    return [{
      key: oneOffKey(oneOff.name),
      name: item?.name ?? oneOff.name,
      category: item?.category ?? OTHER_SECTION,
      reason: 'added' as const,
      neededFor: [],
      quantity: null,
      store: storeFor(item, weekStore),
      pantryItemId: item?.id ?? null,
      walmartItemId: item?.walmartItemId ?? oneOff.walmartItemId,
      packages: item?.minPackages ?? 1,
      sizeUnknown: false,
    }];
  });
}

/** What a typed one-off costs, when it's nothing the pantry has a price for. */
export function oneOffPrice(oneOffs: readonly OneOff[], line: Pick<ShoppingLine, 'key'>): Price | null {
  const cents = oneOffs.find(o => oneOffKey(o.name) === line.key)?.cents ?? null;
  return cents === null ? null : { cents, source: 'typed', product: null, checkedAt: '' };
}

/** What a price lookup may look for: a one-off with no item has nowhere to keep the answer. */
export function canLookUpPrice(line: Pick<ShoppingLine, 'key' | 'pantryItemId'>): boolean {
  return !isOneOffKey(line.key) || line.pantryItemId !== null;
}

type Trimmable = ShoppingLine & { price: Price | null };

/**
 * What can come off when the trip is over budget: lines with a price, since nothing's known about
 * the rest, and not what's already in the basket. Restocks first, because no meal is waiting on
 * them, then the biggest savings.
 */
export function trimChoices<T extends Trimmable>(lines: readonly T[], ticked: ReadonlySet<string>): T[] {
  const cost = (line: T) => (line.price ? lineCents(line, line.price) : 0);
  const forMeal = (line: T) => (line.neededFor.length ? 1 : 0);
  return lines.filter(l => l.price && !ticked.has(l.key)).sort((a, b) => forMeal(a) - forMeal(b) || cost(b) - cost(a));
}

/** How far the trip, tax included, is over its budget. 0 with no budget or room to spare. */
export function overBudget(budget: number | null, withTax: number): number {
  return budget !== null && withTax > budget ? withTax - budget : 0;
}
