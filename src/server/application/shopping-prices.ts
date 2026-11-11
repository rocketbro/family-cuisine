// Typed prices and Walmart product matches for list lines. A line for something not in the pantry yet gets a pantry item the first
// time it's priced or matched, so the price and product are remembered next week. A one-off keeps
// its own, for this trip only.
import { parseWalmartItemId, type PantryItem, type Store } from '../../domain/pantry.ts';
import type { Deps } from './deps.ts';
import { changeOneOff } from './trip-one-offs.ts';
import { readWalmartPack } from './walmart-packs.ts';
import { UserError } from './user-error.ts';

export type LineRef = { pantryItemId: number | null; name: string };

/** A typed price wins over the lookup; clearing it hands the line back to the lookup. */
export function setPrice(deps: Deps, line: LineRef, store: Store, cents: number | null): void {
  if (changeOneOff(deps, line, { cents })) return;
  const item = itemFor(deps, line);
  deps.prices.save(item.id, store, cents === null ? null : { cents, source: 'typed', product: null });
}

/** Saves the Walmart product for a line from a pasted product link (or a bare item ID). */
export async function setWalmartProduct(deps: Deps, line: LineRef, link: string): Promise<PantryItem | null> {
  const itemId = parseWalmartItemId(link);
  if (!itemId) throw new UserError('That doesn’t look like a Walmart product link. Open the product, tap Share, and copy the link.');
  if (changeOneOff(deps, line, { walmartItemId: itemId })) return null;
  const item = itemFor(deps, line);
  deps.pantry.update(item.id, { walmartItemId: itemId, packSize: null });
  // Right away, so the cart is right the moment it's linked. If this fails, the next sweep gets it.
  await readWalmartPack(deps, item.id, itemId).catch((error: Error) => deps.log(`Walmart package size: ${error.message}`));
  return deps.pantry.get(item.id) ?? item;
}

export function itemFor(deps: Deps, line: LineRef): PantryItem {
  const existing = line.pantryItemId !== null ? deps.pantry.get(line.pantryItemId) : deps.pantry.findByName(line.name);
  return existing ?? deps.pantry.create({ name: line.name, status: 'out' });
}
