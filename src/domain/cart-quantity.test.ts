import { describe, expect, it } from 'vitest';
import { packagesNeeded } from './cart-quantity.ts';
import { parsePackSize } from './pack-size.ts';

describe('packages to cover the week', () => {
  const eggs = parsePackSize('Eggs 18 Count');
  it('buys enough cartons for what the count falls short of', () => {
    expect(packagesNeeded([{ amount: 28, unit: null }], eggs, 9)).toBe(2);
    expect(packagesNeeded([{ amount: 18, unit: null }], eggs, 0)).toBe(1);
    expect(packagesNeeded([{ amount: 19, unit: null }], eggs, 0)).toBe(2);
  });
  it('adds up weights and volumes against the package', () => {
    const flour = parsePackSize('Flour, 5 lb Bag');
    expect(packagesNeeded([{ amount: 4, unit: 'cup' }], flour)).toBe(1);
    expect(packagesNeeded([{ amount: 6, unit: 'lb' }], flour)).toBe(2);
    expect(packagesNeeded([{ amount: 3, unit: 'lb' }, { amount: 3, unit: 'lb' }], flour)).toBe(2);
  });
  it('takes cans one for one, and lets portions on hand cover a share', () => {
    expect(packagesNeeded([{ amount: 3, unit: 'can' }], parsePackSize('Black Beans, 15 oz Can'))).toBe(3);
    expect(packagesNeeded([{ amount: 8, unit: 'lb' }], parsePackSize('Beef, 2 lb'), 0, 0.5)).toBe(2);
  });
  it('gives no answer when the need and the package can\u2019t be compared', () => {
    expect(packagesNeeded([{ amount: 6, unit: null }], parsePackSize('Onions, 3 lb Bag'))).toBeNull();
    expect(packagesNeeded([{ amount: 2, unit: 'lb' }], null)).toBeNull();
  });
});
