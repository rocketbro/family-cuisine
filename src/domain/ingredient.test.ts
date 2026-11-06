import { describe, expect, it } from 'vitest';
import { formatIngredientLine, parseIngredientLine } from './ingredient.ts';

describe('ingredient lines', () => {
  it('parses amount, unit, item, note and optional', () => {
    expect(parseIngredientLine('- 1 1/2 cups rolled oats, plus more for the top')).toMatchObject({ amount: 1.5, unit: 'cup', item: 'rolled oats', note: 'plus more for the top' });
    expect(parseIngredientLine('- 2 large eggs')).toMatchObject({ amount: 2, unit: null, item: 'large eggs' });
    expect(parseIngredientLine('- salt, to taste')).toMatchObject({ amount: null, item: 'salt', note: 'to taste' });
    expect(parseIngredientLine('- fresh parsley, chopped (optional)')).toMatchObject({ item: 'fresh parsley', optional: true });
    expect(parseIngredientLine('- 2-3 cloves garlic')).toMatchObject({ amount: 2, amountMax: 3, unit: 'clove', item: 'garlic' });
  });
  it('round-trips the canonical form', () => {
    const line = '- 2/3 cup buttermilk, cold';
    expect(formatIngredientLine(parseIngredientLine(line)!)).toBe(line);
  });
});

describe('optional ingredients with something to say', () => {
  it('keeps the item name clean', () => {
    expect(parseIngredientLine('- jam (optional, any kind)')).toMatchObject({ item: 'jam', optional: true, note: 'any kind' });
    expect(parseIngredientLine('- fresh parsley, chopped (optional)')).toMatchObject({ item: 'fresh parsley', optional: true, note: 'chopped' });
  });
});
