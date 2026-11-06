import { describe, expect, it } from 'vitest';
import { recipeAvailability } from './availability.ts';
import { parseIngredientLine } from './ingredient.ts';
import type { PantryItem } from './pantry.ts';
import { applySubstitutions, decodeSubstitutions, encodeSubstitutions, ruleFor, substitutesFor } from './substitutes.ts';

describe('substitutes', () => {
  const pantry: PantryItem[] = [
    { id: 1, name: 'eggs', category: 'Dairy & eggs', status: 'out', count: 0, staple: false, store: 'any', walmartItemId: null, packSize: null, stockUp: null, minPackages: 1, occasional: false, useBy: null, useByEstimated: false, lastsDays: null, portions: [], alsoCalled: [] },
    { id: 2, name: 'ground flaxseed', category: 'Baking', status: 'have', count: null, staple: false, store: 'any', walmartItemId: null, packSize: null, stockUp: null, minPackages: 1, occasional: false, useBy: null, useByEstimated: false, lastsDays: null, portions: [], alsoCalled: [] },
    { id: 3, name: 'peanut butter', category: 'Pantry', status: 'have', count: null, staple: false, store: 'any', walmartItemId: null, packSize: null, stockUp: null, minPackages: 1, occasional: false, useBy: null, useByEstimated: false, lastsDays: null, portions: [], alsoCalled: [] },
  ];
  const recipe = ['- 2 large eggs', '- 1/2 cup sugar', '- 2 tbsp peanut butter', '- 1 tsp baking powder'].map(l => parseIngredientLine(l)!);

  it('finds swaps by the ingredient\'s last words, most specific first', () => {
    expect(ruleFor('large eggs')?.names).toContain('egg');
    expect(ruleFor('light brown sugar')?.names).toContain('brown sugar');
    expect(ruleFor('peanut butter')).toBeNull();
    expect(ruleFor('buttermilk')?.names).toEqual(['buttermilk']);
  });

  it('scales each swap to the recipe and checks the pantry', () => {
    const subs = substitutesFor(recipe, pantry);
    expect(subs.map(s => s.index)).toEqual([0, 1, 3]);
    const flax = subs[0].options[0];
    expect(flax.id).toBe('flax-egg');
    expect(flax.missing).toEqual([]);
    expect(flax.ingredients.map(i => [i.amount, i.unit, i.item])).toEqual([[2, 'tbsp', 'ground flaxseed'], [6, 'tbsp', 'water']]);
    const honey = subs[1].options.find(o => o.id === 'honey')!;
    expect(honey.ingredients[0].amount).toBe(0.375);
    expect(honey.missing).toEqual(['honey']);
  });

  it('makes a working copy with the chosen swaps', () => {
    const copy = applySubstitutions(recipe, decodeSubstitutions(encodeSubstitutions({ 0: 'flax-egg' })));
    expect(copy.map(i => i.item)).toEqual(['ground flaxseed', 'water', 'sugar', 'peanut butter', 'baking powder']);
    expect(copy[0].note).toBe('instead of large eggs');
    expect(recipeAvailability(copy, pantry).missing).not.toContain('eggs');
  });
});

describe('cacao for cocoa', () => {
  it('offers cacao powder when a recipe asks for cocoa', () => {
    expect(ruleFor('cocoa powder')?.options.map(o => o.id)).toContain('cacao');
  });
});
