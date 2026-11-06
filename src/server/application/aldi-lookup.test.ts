import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blankEntry } from '../../domain/plan.ts';
import { refreshAldiPrices } from './aldi-lookup.ts';
import { recentMisses, recordMisses } from './lookup-misses.ts';
import type { StorePriceQuote } from './ports/prices.ts';
import { setPrice } from './shopping-prices.ts';
import { setStoreZip } from './store-location.ts';
import { pantryItem, recipe } from '../../domain/test-fixtures.ts';
import { deferred, fakeDeps, type Fakes } from './test-support/full-deps-fake.ts';

const TODAY = '2026-11-03'; // A Tuesday; shopping's Wednesday.
const home = { zip: '27601', latitude: 35, longitude: -78, place: 'Raleigh, NC' };
const quote = (cents: number): Map<string, StorePriceQuote> => new Map([['eggs', { cents, product: 'Goldhen Large Eggs, 12 ct' }]]);
const eggs = { pantryItemId: 1, name: 'eggs' };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-03T12:00:00'));
});
afterEach(() => void vi.useRealTimers());

function shoppingForEggs(): Fakes {
  const deps = fakeDeps({ recipes: [recipe('frittata', ['- 6 eggs'])], pantry: [pantryItem(1, 'eggs', { status: 'out' })] });
  deps.household.saveSetting('store_location', JSON.stringify(home));
  deps.plan.upsert({ ...blankEntry('2026-11-04', 'dinner'), kind: 'recipe', recipeSlug: 'frittata' });
  return deps;
}

function holdTheLookup(deps: Fakes) {
  const held = deferred<Map<string, StorePriceQuote>>();
  deps.lookup = () => held.promise;
  return held;
}

describe('Aldi prices coming back from a lookup', () => {
  it('saves what it finds', async () => {
    const deps = shoppingForEggs();
    deps.lookup = () => Promise.resolve(quote(311));
    expect(await refreshAldiPrices(deps, TODAY)).toBe(1);
    expect(deps.priceTable.get(1)).toMatchObject({ cents: 311, source: 'lookup' });
  });

  it('leaves a price typed during the lookup', async () => {
    const deps = shoppingForEggs();
    const held = holdTheLookup(deps);
    const lookup = refreshAldiPrices(deps, TODAY);
    setPrice(deps, eggs, 'aldi', 250);
    held.resolve(quote(311));
    expect(await lookup).toBe(0);
    expect(deps.priceTable.get(1)).toMatchObject({ cents: 250, source: 'typed' });
  });

  it('leaves a price from a receipt saved during the lookup', async () => {
    const deps = shoppingForEggs();
    const held = holdTheLookup(deps);
    const lookup = refreshAldiPrices(deps, TODAY);
    deps.prices.save(1, 'aldi', { cents: 299, source: 'receipt', product: 'EGGS' });
    held.resolve(quote(311));
    await lookup;
    expect(deps.priceTable.get(1)).toMatchObject({ cents: 299, source: 'receipt' });
  });

  it('still updates a week-old looked-up price', async () => {
    const deps = shoppingForEggs();
    deps.priceTable.set(1, { cents: 200, source: 'lookup', product: 'Eggs', checkedAt: '2026-10-01T00:00:00.000Z' });
    deps.lookup = () => Promise.resolve(quote(311));
    await refreshAldiPrices(deps, TODAY);
    expect(deps.priceTable.get(1)?.cents).toBe(311);
  });

  it('throws away quotes from before a ZIP change', async () => {
    const deps = shoppingForEggs();
    const held = holdTheLookup(deps);
    const lookup = refreshAldiPrices(deps, TODAY);
    deps.household.saveSetting('store_location', JSON.stringify({ ...home, zip: '10001' }));
    deps.prices.forgetLookups('aldi');
    held.resolve(quote(311));
    expect(await lookup).toBe(0);
    expect(deps.priceTable.has(1)).toBe(false);
  });

  it('does not remember misses from before a ZIP change', async () => {
    const deps = shoppingForEggs();
    const held = holdTheLookup(deps);
    const lookup = refreshAldiPrices(deps, TODAY);
    deps.household.saveSetting('store_location', JSON.stringify({ ...home, zip: '10001' }));
    held.resolve(new Map());
    await lookup;
    expect(recentMisses(deps, new Date()).size).toBe(0);
  });

  it('throws away quotes when the ZIP was cleared during the lookup', async () => {
    const deps = shoppingForEggs();
    const held = holdTheLookup(deps);
    const lookup = refreshAldiPrices(deps, TODAY);
    deps.household.saveSetting('store_location', null);
    held.resolve(quote(311));
    await lookup;
    expect(deps.priceTable.has(1)).toBe(false);
  });
});

describe('clearing the ZIP', () => {
  it('forgets looked-up prices and misses, and keeps typed and receipt prices', async () => {
    const deps = shoppingForEggs();
    deps.pantry.list().push(pantryItem(2, 'milk'), pantryItem(3, 'bread'));
    deps.prices.save(1, 'aldi', { cents: 311, source: 'lookup', product: 'EGGS' });
    deps.prices.save(2, 'aldi', { cents: 250, source: 'typed', product: null });
    deps.prices.save(3, 'aldi', { cents: 299, source: 'receipt', product: 'BREAD' });
    recordMisses(deps, ['saffron'], new Date());

    await setStoreZip(deps, null);
    expect(deps.priceTable.has(1)).toBe(false);
    expect(deps.priceTable.get(2)).toMatchObject({ cents: 250, source: 'typed' });
    expect(deps.priceTable.get(3)).toMatchObject({ cents: 299, source: 'receipt' });
    expect(recentMisses(deps, new Date()).size).toBe(0);
  });
});

describe('an item removed during a lookup', () => {
  it('isn’t put back by the answer', async () => {
    const deps = shoppingForEggs();
    const held = holdTheLookup(deps);
    const lookup = refreshAldiPrices(deps, TODAY);
    await new Promise(resolve => setImmediate(resolve));
    deps.pantry.list().splice(0, 1);
    held.resolve(quote(311));
    expect(await lookup).toBe(0);
    expect(deps.pantry.findByName('eggs')).toBeNull();
    expect(deps.priceTable.size).toBe(0);
  });

  it('still gives a line that was never in the pantry its item', async () => {
    const deps = fakeDeps({ recipes: [recipe('frittata', ['- 6 eggs'])], pantry: [] });
    deps.household.saveSetting('store_location', JSON.stringify(home));
    deps.plan.upsert({ ...blankEntry('2026-11-04', 'dinner'), kind: 'recipe', recipeSlug: 'frittata' });
    deps.lookup = () => Promise.resolve(quote(311));
    expect(await refreshAldiPrices(deps, TODAY)).toBe(1);
    expect(deps.pantry.findByName('eggs')).not.toBeNull();
  });
});
