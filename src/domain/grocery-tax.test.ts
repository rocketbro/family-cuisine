import { describe, expect, it } from 'vitest';
import { groceryTaxRate, listTax } from './grocery-tax.ts';

describe('grocery tax', () => {
  it('uses the state food rate from the ZIP, and stays quiet where it is unknown', () => {
    expect(groceryTaxRate('Raleigh, NC')).toBe(0.02);
    expect(groceryTaxRate('Indianapolis, IN')).toBeNull();
    expect(listTax(1526, 0.02)).toEqual({ rate: 0.02, cents: 31 });
    expect(listTax(1526, null)).toBeNull();
  });
});
