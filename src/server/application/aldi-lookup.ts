// Aldi shelf prices for this week's list, looked up by the household's ZIP. Only when ALDI_PRICE_LOOKUP
// is on (see the README); otherwise nothing here calls out. Best effort: when the lookup breaks, the list keeps whatever prices it had and typed ones fill the gaps.
import type { ISODate } from '../../domain/dates.ts';
import { needsLookup } from '../../domain/prices.ts';
import type { Deps } from './deps.ts';
import { recentMisses, recordMisses } from './lookup-misses.ts';
import { runOnce } from './lookup-state.ts';
import { itemFor } from './shopping-prices.ts';
import { shoppingWeek } from './shopping.ts';
import { storeLocation } from './store-location.ts';

/** Looks up this week's Aldi lines that have no price or a week-old one. One run at a time. */
export function refreshAldiPrices(deps: Deps, today: ISODate): Promise<number> {
  return runOnce(deps.lookups, () => lookUp(deps, today));
}

async function lookUp(deps: Deps, today: ISODate): Promise<number> {
  const location = storeLocation(deps);
  if (!location || !deps.storePrices) return 0;
  const now = new Date();
  const misses = recentMisses(deps, now);
  const stale = shoppingWeek(deps, today).lines.filter(l => l.store === 'aldi' && needsLookup(l.price, now) && !misses.has(l.name));
  if (!stale.length) return 0;
  const quotes = await deps.storePrices.lookup(stale.map(l => l.name), location);
  // The lookup took a while. These answers are for a store they've since moved away from.
  if (storeLocation(deps)?.zip !== location.zip) {
    deps.log(`aldi prices: dropped a lookup for ${location.zip}, the ZIP changed`);
    return 0;
  }
  // Nothing waits from here on. A price typed or from a receipt in the meantime stands.
  const current = deps.prices.forStore('aldi');
  let saved = 0;
  for (const line of stale) {
    const quote = quotes.get(line.name);
    if (!quote) continue;
    // Taken out of the pantry during the lookup: it stays out.
    if (line.pantryItemId !== null && !deps.pantry.get(line.pantryItemId)) continue;
    const { id } = itemFor(deps, line);
    if (!needsLookup(current.get(id) ?? null, now)) continue;
    deps.prices.save(id, 'aldi', { cents: quote.cents, source: 'lookup', product: quote.product });
    saved += 1;
  }
  recordMisses(deps, stale.filter(l => !quotes.has(l.name)).map(l => l.name), now);
  deps.log(`aldi prices: ${saved} of ${stale.length} found near ${location.zip}`);
  return saved;
}
