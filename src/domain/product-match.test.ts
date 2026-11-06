import { describe, expect, it } from 'vitest';
import { bestProduct } from './product-match.ts';

describe('matching a list line to a store product', () => {
  const eggs = [
    { name: 'Simply Nature Organic Cage Free Eggs - 1 Dozen, 24 oz', cents: 375 },
    { name: 'Goldhen Large Grade A Eggs, 12 ct', cents: 179 },
    { name: 'Goldhen Large Grade A Eggs, 18 ct', cents: 279 },
  ];
  it('takes the cheapest product that has every word of the item', () => {
    expect(bestProduct('eggs', eggs)?.cents).toBe(179);
    expect(bestProduct('large eggs', eggs)?.cents).toBe(179);
  });
  it('finds nothing rather than the wrong thing', () => {
    expect(bestProduct('smoked paprika', [{ name: 'Stonemill Garlic Powder Seasoning, 3.12 oz', cents: 99 }])).toBeNull();
  });
});
