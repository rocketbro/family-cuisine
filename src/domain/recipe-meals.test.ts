import { describe, expect, it } from 'vitest';
import { plannableMeals, recipeMealLabel } from './recipe.ts';

describe('what a recipe is good for', () => {
  it('gives a planner only real meals', () => {
    expect(plannableMeals(['breakfast', 'extra'])).toEqual(['breakfast']);
    expect(plannableMeals(['extra'])).toEqual([]);
    expect(plannableMeals(['lunch', 'dinner'])).toEqual(['lunch', 'dinner']);
  });

  it('labels each for a chip', () => {
    expect(recipeMealLabel('extra')).toBe('Extras');
    expect(recipeMealLabel('dinner')).toBe('Dinner');
  });
});
