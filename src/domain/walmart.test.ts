import { describe, expect, it } from 'vitest';
import { addSent, unsentLines, walmartCartUrl } from './walmart.ts';

describe('the Walmart cart link', () => {
  it('builds the Walmart cart link', () => {
    expect(walmartCartUrl([{ itemId: '1234567', quantity: 1 }, { itemId: '7654321', quantity: 3 }])).toBe(
      'https://www.walmart.com/affil/cart/addToCart?items=1234567,7654321%7C3',
    );
  });
});

describe('sending the list to the Walmart cart twice', () => {
  const lines = [{ itemId: '1', quantity: 1 }, { itemId: '2', quantity: 5 }];

  it('sends everything the first time', () => {
    expect(unsentLines(lines, {})).toEqual(lines);
  });

  it('sends nothing again once it has all gone', () => {
    expect(unsentLines(lines, addSent({}, lines))).toEqual([]);
    expect(walmartCartUrl(unsentLines(lines, addSent({}, lines)))).toBeNull();
  });

  it('sends only what is new, and the difference when a quantity went up', () => {
    const sent = addSent({}, [{ itemId: '1', quantity: 1 }, { itemId: '2', quantity: 3 }]);
    expect(unsentLines([...lines, { itemId: '3', quantity: 1 }], sent)).toEqual([{ itemId: '2', quantity: 2 }, { itemId: '3', quantity: 1 }]);
  });
});
