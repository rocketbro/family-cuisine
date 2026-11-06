import { describe, expect, it } from 'vitest';
import { recipeAvailability } from './availability.ts';
import { parseIngredientLine } from './ingredient.ts';
import type { Portion } from './portions.ts';
import { rotationPlan } from './rotation-planner.ts';
import { pantryAfterMeal } from './running-pantry.ts';
import { pantryItem } from './test-fixtures.ts';

describe('the pantry after a meal', () => {
  const ingredients = (...lines: string[]) => lines.map(line => parseIngredientLine(line)!);
  const pound = (amount: number): Portion => ({ storage: 'fresh', amount, unit: 'lb', canOz: null, useBy: null, useByEstimated: false });

  it('takes counts down, so a second meal doesn’t fit what one already used', () => {
    const pantry = [pantryItem(1, 'eggs', { count: 6 })];
    const eggs = ingredients('- 4 eggs');
    expect(recipeAvailability(eggs, pantry).level).toBe('ready');
    const after = pantryAfterMeal(pantry, eggs);
    expect(after[0].count).toBe(2);
    expect(recipeAvailability(eggs, after).level).not.toBe('ready');
    expect(pantry[0].count).toBe(6);
  });
  it('scales by the batch', () => {
    expect(pantryAfterMeal([pantryItem(1, 'eggs', { count: 6 })], ingredients('- 2 eggs'), 2)[0].count).toBe(2);
  });
  it('takes measured portions down, and one used up reads as missing', () => {
    const beef = ingredients('- 1 lb beef');
    const after = pantryAfterMeal([pantryItem(1, 'beef', { portions: [pound(1)] })], beef);
    expect(after[0]).toMatchObject({ portions: [], status: 'out' });
    expect(recipeAvailability(beef, after).level).not.toBe('ready');
  });
  it('leaves what has no known amount, what’s optional and staples', () => {
    const pantry = [pantryItem(1, 'rice'), pantryItem(2, 'eggs', { count: 2 }), pantryItem(3, 'salt', { staple: true, count: 1 })];
    const after = pantryAfterMeal(pantry, ingredients('- 1 cup rice', '- 2 eggs (optional)', '- 1 salt'));
    expect(after).toEqual(pantry);
  });
  it('lets the rotation hold its choices to one pantry', () => {
    let pantry = [pantryItem(1, 'eggs', { count: 6 })];
    const lines = ingredients('- 4 eggs');
    const dates = ['2026-11-04', '2026-11-05'];
    const planned = rotationPlan({
      dates, existing: [], portions: 1,
      recipes: [{ slug: 'frittata', meals: ['dinner'], kind: 'recipe', batch: false, serves: 4 }, { slug: 'omelet', meals: ['dinner'], kind: 'recipe', batch: false, serves: 4 }],
      canCook: (_recipe, _date, multiplier) => recipeAvailability(lines, pantry, multiplier).level === 'ready',
      onChoose: (_recipe, _date, multiplier) => { pantry = pantryAfterMeal(pantry, lines, multiplier); },
    });
    expect(planned.map(e => e.date)).toEqual(['2026-11-04']);
  });
});
