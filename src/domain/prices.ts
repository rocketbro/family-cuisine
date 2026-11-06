// What the list will cost. Prices are per package (a dozen eggs, a half gallon of milk): typed
// in, looked up from the store by ZIP, or what the last receipt said was paid. The total is a
// guide, not a receipt.
import { parsePackSize, type PackSize } from './pack-size.ts';

export type PriceSource = 'typed' | 'lookup' | 'receipt';

export type Price = {
  cents: number;
  source: PriceSource;
  /** The store's product the lookup matched ("Goldhen Large Eggs, 12 ct"). */
  product: string | null;
  /** When the lookup last checked it (ISO timestamp). */
  checkedAt: string;
};

export type ListTotal = { cents: number; priced: number; unpriced: number };

const STALE_DAYS = 7;

/** Looked-up prices are rechecked weekly; typed ones stand until someone changes them. */
export function needsLookup(price: Price | null, now: Date): boolean {
  if (!price) return true;
  if (price.source === 'typed') return false;
  // Looked up before we kept what a by-weight package weighs.
  if (price.source === 'lookup' && price.product && /\bper lb\b/i.test(price.product)) return true;
  return now.getTime() - new Date(price.checkedAt).getTime() > STALE_DAYS * 86_400_000;
}

/** A line's price in all. */
export function lineCents(line: { packages: number }, price: Pick<Price, 'cents'>): number {
  return price.cents * line.packages;
}

/** Sold by weight, so the price is an estimate for a package "about 1.85 lb". */
export function soldByWeight(product: string | null | undefined): boolean {
  return product != null && /\babout [\d.]+ lb\b/i.test(product);
}

/** The line's cost is a best guess, which the list marks with ≈. */
export function isEstimate(line: { sizeUnknown: boolean; price?: Pick<Price, 'product'> | null }): boolean {
  return line.sizeUnknown || soldByWeight(line.price?.product);
}

/** Package sizes the products' names give ("Goldhen Large Eggs, 12 ct", "Chicken Thighs, about 1.85 lb"). */
export function packsFromProducts(prices: ReadonlyMap<number, Pick<Price, 'product'>>): Map<number, PackSize> {
  const packs = new Map<number, PackSize>();
  for (const [id, { product }] of prices) {
    const pack = product ? parsePackSize(product) : null;
    if (pack?.count || pack?.measure) packs.set(id, pack);
  }
  return packs;
}

export function listTotal(prices: readonly (Price | null)[]): ListTotal {
  const known = prices.filter((p): p is Price => p !== null);
  return {
    cents: known.reduce((sum, p) => sum + p.cents, 0),
    priced: known.length,
    unpriced: prices.length - known.length,
  };
}

/** A couple of missing prices don't change the picture; more than that and the total can't be trusted. */
const UNPRICED_ALLOWED = 2;

/** What the budget has left after the list, or null with no budget or too few prices. */
export function budgetRoom(budget: number | null, total: ListTotal, withTax: number): number | null {
  if (budget === null || total.unpriced > UNPRICED_ALLOWED) return null;
  return Math.max(0, budget - withTax);
}

export function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "3.11", "$3", " 12.5 " → cents. Empty or nonsense means "no price". */
export function parseDollars(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 && value < 10_000 ? Math.round(value * 100) : null;
}
