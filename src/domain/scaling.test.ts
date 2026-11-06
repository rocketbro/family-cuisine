import { describe, expect, it } from 'vitest';
import { usesText } from './drafted-meal.ts';
import { parseIngredientLine } from './ingredient.ts';
import { countedName, isPlausibleModelBatch, scaleIngredient } from './scaling.ts';

describe('scaling', () => {
  it.each([[0.5, true], [4, true], [0, false], [-1, false], [4.5, false]])('counts %s batches from the model as plausible: %s', (multiplier, plausible) => {
    expect(isPlausibleModelBatch(multiplier)).toBe(plausible);
  });

  it('upgrades tsp to tbsp when tripled and keeps fractions friendly', () => {
    expect(scaleIngredient(parseIngredientLine('- 1 tsp baking powder')!, 3).amountText).toBe('1 tbsp');
    expect(scaleIngredient(parseIngredientLine('- 2/3 cup buttermilk')!, 1.5).amountText).toBe('1 cup');
    expect(scaleIngredient(parseIngredientLine('- 1/2 cup sugar')!, 0.5).amountText).toBe('¼ cup');
    expect(scaleIngredient(parseIngredientLine('- salt, to taste')!, 2).amountText).toBeNull();
  });
});

describe('names that agree with the count', () => {
  it('goes singular at one or less', () => {
    expect(countedName('red bell peppers', 1)).toBe('red bell pepper');
    expect(countedName('yellow onions', 0.5)).toBe('yellow onion');
    expect(countedName('bay leaves', 1)).toBe('bay leaf');
    expect(countedName('tomatoes', 1)).toBe('tomato');
    expect(countedName('celery', 1)).toBe('celery');
  });
  it('leaves words that only look plural alone', () => {
    expect(countedName('hummus', 1)).toBe('hummus');
    expect(countedName('watercress', 1)).toBe('watercress');
    expect(countedName('asparagus', 1)).toBe('asparagus');
  });
  it('goes plural only for things certainly counted', () => {
    expect(countedName('yellow onion', 2)).toBe('yellow onions');
    expect(countedName('bay leaf', 2)).toBe('bay leaves');
    expect(countedName('stalks celery', 3)).toBe('stalks celery');
    expect(countedName('head lettuce', 2)).toBe('head lettuce');
  });
  it('shows through scaling, and not when there is a measure', () => {
    expect(scaleIngredient(parseIngredientLine('- 1 green bell peppers, sliced')!, 1).item).toBe('green bell pepper');
    expect(scaleIngredient(parseIngredientLine('- 1 green bell peppers, sliced')!, 2).item).toBe('green bell peppers');
    expect(scaleIngredient(parseIngredientLine('- 1 can black beans')!, 1).item).toBe('black beans');
  });
  it('shows in what a drafted meal uses', () => {
    expect(usesText([{ name: 'green bell peppers', text: '1' }, { name: 'bratwurst', text: '1 lb' }, { name: 'yellow onion', text: '2' }])).toBe('1 green bell pepper, 1 lb bratwurst, 2 yellow onions');
  });
});
