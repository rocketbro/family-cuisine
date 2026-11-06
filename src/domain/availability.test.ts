import { describe, expect, it } from 'vitest';
import { recipeAvailability, ingredientStock } from './availability.ts';
import { substitutesFor } from './substitutes.ts';
import { pantryItem, recipe } from './test-fixtures.ts';

describe('availability', () => {
  const pantry = [pantryItem(1, 'eggs', { count: 2 }), pantryItem(2, 'flour'), pantryItem(3, 'salt', { staple: true }), pantryItem(4, 'buttermilk', { status: 'out' })];
  it('grades ready, most and missing', () => {
    expect(recipeAvailability(recipe('a', ['- 1 cup flour', '- salt']).ingredients, pantry).level).toBe('ready');
    expect(recipeAvailability(recipe('b', ['- 1 cup flour', '- 1 cup buttermilk', '- 1 cup sugar', '- 2 eggs']).ingredients, pantry).level).toBe('missing');
    expect(recipeAvailability(recipe('c', ['- 1 cup flour', '- 1 cup buttermilk', '- 2 eggs', '- salt', '- 1 tsp vanilla, x (optional)']).ingredients, pantry).level).toBe('most');
  });
  it('counts eggs against the multiplier', () => {
    const r = recipe('d', ['- 2 eggs']);
    expect(recipeAvailability(r.ingredients, pantry, 1).level).toBe('ready');
    expect(recipeAvailability(r.ingredients, pantry, 2).short).toEqual(['eggs']);
  });
});

describe('not enough for this batch', () => {
  const pantry = [pantryItem(1, 'eggs', { count: 3 }), pantryItem(2, 'flour'), pantryItem(3, 'sugar'), pantryItem(4, 'milk'), pantryItem(5, 'butter'), pantryItem(6, 'vanilla')];
  it('isn\'t ready when the eggs on hand fall short', () => {
    const { level, short, low, missing } = recipeAvailability(recipe('a', ['- 6 eggs']).ingredients, pantry);
    expect(level).not.toBe('ready');
    expect(short).toEqual(['eggs']);
    expect(low).toEqual([]);
    expect(missing).toEqual([]);
  });
  it('grades a shortfall like something missing', () => {
    const big = recipe('b', ['- 6 eggs', '- 1 cup flour', '- 1 cup sugar', '- 1 cup milk', '- 1 tbsp butter', '- 1 tsp vanilla']);
    expect(recipeAvailability(big.ingredients, pantry).level).toBe('most');
    expect(recipeAvailability(recipe('c', ['- 6 eggs', '- 1 cup flour']).ingredients, pantry).level).toBe('missing');
  });
  it('stays ready when there\'s enough but it\'s running low', () => {
    const low = [pantryItem(1, 'eggs', { count: 6, status: 'low' }), pantryItem(2, 'flour', { status: 'low' })];
    const result = recipeAvailability(recipe('d', ['- 6 eggs', '- 1 cup flour']).ingredients, low);
    expect(result.level).toBe('ready');
    expect(result.low).toEqual(['eggs', 'flour']);
    expect(result.short).toEqual([]);
  });
  it('calls none left missing, not short', () => {
    expect(ingredientStock(recipe('e', ['- 2 eggs']).ingredients[0], [pantryItem(1, 'eggs', { count: 0 })])).toBe('missing');
  });
  it('counts the batch size', () => {
    expect(recipeAvailability(recipe('f', ['- 2 eggs']).ingredients, pantry, 2).level).not.toBe('ready');
  });
  it('doesn\'t offer a swap as "have it" when there isn\'t enough for it', () => {
    const house = [pantryItem(1, 'butter', { status: 'out' }), pantryItem(2, 'olive oil', { portions: [{ storage: 'fresh', amount: 1, unit: 'tbsp', canOz: null, useBy: null, useByEstimated: false }] })];
    const oil = substitutesFor(recipe('g', ['- 1 cup butter']).ingredients, house)[0].options.find(o => o.id === 'oil')!;
    expect(oil.missing).toEqual(['olive oil']);
  });
});
