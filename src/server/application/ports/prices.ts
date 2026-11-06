import type { Store } from '../../../domain/pantry.ts';
import type { Price } from '../../../domain/prices.ts';

export type WalmartProductPort = {
  /** The product's name on Walmart, or null when it no longer sells it. Throws when Walmart isn't answering. */
  productName(itemId: string): Promise<string | null>;
};

export type StoreLocation = { zip: string; latitude: number; longitude: number };

export type StorePriceQuote = { cents: number; product: string };

/** Looks up shelf prices for list items near a ZIP code. Best effort: it can break. */
export type StorePricePort = {
  lookup(names: string[], location: StoreLocation): Promise<Map<string, StorePriceQuote>>;
};

/** Where a ZIP code is, for stores that need coordinates. */
export type ZipLookupPort = {
  locate(zip: string): Promise<{ latitude: number; longitude: number; place: string } | null>;
};

/** What each pantry item costs at each store, as the family set it or an estimate. */
export type PriceRepository = {
  forStore(store: Store): Map<number, Price>;
  save(pantryItemId: number, store: Store, price: Pick<Price, 'cents' | 'source' | 'product'> | null): void;
  /** Drops looked-up prices (the ZIP changed); typed ones stay. */
  forgetLookups(store: Store): void;
};
