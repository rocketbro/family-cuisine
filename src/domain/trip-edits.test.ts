import { describe, expect, it } from 'vitest';
import type { Price } from './prices.ts';
import type { ShoppingLine } from './shopping.ts';
import { canLookUpPrice, oneOffKey, oneOffLines, oneOffPrice, overBudget, trimChoices } from './trip-edits.ts';
import { pantryItem } from './test-fixtures.ts';
import { alreadySent } from './walmart.ts';

const price = (cents: number): Price => ({ cents, source: 'typed', product: null, checkedAt: '' });
const line = (key: string, cents: number | null, over: Partial<ShoppingLine> = {}) => ({
  key, name: key, category: 'Other', reason: 'needed' as const, neededFor: ['Stew'], quantity: null, store: 'aldi' as const,
  pantryItemId: 1, walmartItemId: null, packages: 1, sizeUnknown: false, price: cents === null ? null : price(cents), ...over,
});

describe('one-offs', () => {
  it('keys by the words, so spelling it again is the same line', () => {
    expect(oneOffKey(' Candles ')).toBe(oneOffKey('candle'));
  });

  it('don’t show twice when the list needs the same thing', () => {
    const milk = pantryItem(7, 'milk');
    const oneOff = { name: 'Milk', cents: null, walmartItemId: null };
    expect(oneOffLines([oneOff], [line('p7', null, { pantryItemId: 7, name: 'milk' })], [milk], 'aldi')).toEqual([]);
    expect(oneOffLines([oneOff], [], [milk], 'aldi')[0]).toMatchObject({ pantryItemId: 7, name: 'milk', key: 'o:milk' });
  });

  it('carry their own price, and aren’t looked up without an item', () => {
    const oneOffs = [{ name: 'tape', cents: 250, walmartItemId: null }];
    expect(oneOffPrice(oneOffs, { key: 'o:tape' })?.cents).toBe(250);
    expect(oneOffPrice(oneOffs, { key: 'o:glue' })).toBeNull();
    expect(canLookUpPrice({ key: 'o:tape', pantryItemId: null })).toBe(false);
    expect(canLookUpPrice({ key: 'o:milk', pantryItemId: 7 })).toBe(true);
    expect(canLookUpPrice({ key: 'n:saffron', pantryItemId: null })).toBe(true);
  });
});

describe('getting back under budget', () => {
  it('offers what no meal needs first, then the biggest savings, and only known prices', () => {
    const lines = [
      line('stew beef', 1200), line('rice', 300), line('coffee', 700, { reason: 'restock', neededFor: [] }),
      line('tea', 900, { reason: 'restock', neededFor: [] }), line('saffron', null),
    ];
    expect(trimChoices(lines, new Set()).map(l => l.key)).toEqual(['tea', 'coffee', 'stew beef', 'rice']);
  });

  it('counts packages, and leaves alone what’s already in the basket', () => {
    const lines = [line('a', 500, { packages: 3 }), line('b', 1200), line('c', 2000)];
    expect(trimChoices(lines, new Set(['c'])).map(l => l.key)).toEqual(['a', 'b']);
  });

  it('knows how far over it is', () => {
    expect(overBudget(1000, 1200)).toBe(200);
    expect(overBudget(1000, 900)).toBe(0);
    expect(overBudget(null, 900)).toBe(0);
  });
});

describe('a line already in the Walmart cart', () => {
  it('is told from what’s still to send', () => {
    const toSend = [{ itemId: '1', quantity: 2 }];
    expect(alreadySent({ walmartItemId: '1', packages: 2 }, toSend)).toBe(false);
    expect(alreadySent({ walmartItemId: '1', packages: 3 }, toSend)).toBe(true);
    expect(alreadySent({ walmartItemId: '2', packages: 1 }, toSend)).toBe(true);
    expect(alreadySent({ walmartItemId: null, packages: 1 }, toSend)).toBe(false);
  });
});
