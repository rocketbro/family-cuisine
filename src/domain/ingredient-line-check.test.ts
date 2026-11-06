import { describe, expect, it } from 'vitest';
import { readsAsIngredient } from './ingredient-line-check.ts';

describe('readsAsIngredient', () => {
  it.each([
    '6 cloves garlic', '1 cup milk', '1 1/2 cups rolled oats, plus more for the top', '2-3 tbsp butter', '½ cup milk',
    'salt, to taste', 'parsley, chopped (optional)', '2 large eggs', '2 cans black beans, 15 oz', 'half and half',
    'half-and-half', '1 cup half and half', 'cloves', '1 tsp ground cloves', 'For the sauce:', 'butter, 2 sticks',
  ])('takes %s', line => {
    expect(readsAsIngredient(line)).toBe(true);
  });

  it.each([
    ['nothing there', '   '],
    ['only a note', ', chopped'],
    ['an amount in words', 'two cups flour'],
    ['an article for an amount', 'a pinch of salt'],
    ['a vague amount', 'some milk'],
    ['a unit with no amount', 'cup flour'],
    ['a count with no amount', 'cloves garlic'],
    ['an amount the grammar can’t read', '1/2-ish cup milk'],
    ['a can size in the item', '2 (15 oz) cans black beans'],
    ['a remark in the item', '1 cup milk (instead of cream)'],
    ['optional anywhere but the end', 'parsley (optional), chopped'],
    ['a choice in the item', '1 cup milk or cream'],
    ['to taste without its comma', 'salt to taste'],
    ['a sentence', 'Use whatever milk you have in the fridge for this one.'],
    ['a long group name', `${'very '.repeat(20)}long group:`],
  ])('refuses %s', (_why, line) => {
    expect(readsAsIngredient(line)).toBe(false);
  });
});
