import { describe, expect, it } from 'vitest';
import { parsePackSize } from './pack-size.ts';

describe('package sizes from product names', () => {
  const pack = parsePackSize;
  it('reads counts and measures', () => {
    expect(pack('Great Value Large White Eggs 18 Count')).toEqual({ count: 18, measure: null });
    expect(pack('Great Value All-Purpose Unbleached Wheat Flour, 5 lb Bag')).toEqual({ count: null, measure: { amount: 5, unit: 'lb' } });
    expect(pack('Fresh Banana, Each').count).toBe(1);
    expect(pack('Great Value Paprika, 2.5 oz').measure).toEqual({ amount: 2.5, unit: 'oz' });
    expect(pack('Great Value Whole Vitamin D Milk, Gallon').measure?.unit).toBe('ml');
    expect(pack('PET Dairy Buttermilk, Buttermilk Quart - 1 Jug').measure?.amount).toBeCloseTo(946, 0);
  });
  it('takes the low end of a range and ignores nutrition', () => {
    expect(pack('Chicken Thighs Family Pack, 2.6 - 6.9 lb Tray').measure).toEqual({ amount: 2.6, unit: 'lb' });
    expect(pack('Protein Shake, 30g Protein, 11 Fl Oz, 12 Ct').measure?.amount).toBeCloseTo(325, 0);
    expect(pack('Protein Shake, 30g Protein, 11 Fl Oz, 12 Ct').count).toBe(12);
  });
  it('knows when a name says nothing', () => {
    expect(pack('Santitas Tortilla Chips')).toEqual({ count: null, measure: null });
  });
});
