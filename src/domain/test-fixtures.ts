// Plain pantry items and recipes for the domain's tests. Only test files import this.
import { parseIngredientLine } from './ingredient.ts';
import type { PantryItem } from './pantry.ts';
import type { Recipe } from './recipe.ts';

export const pantryItem = (id: number, name: string, extra: Partial<PantryItem> = {}): PantryItem => ({
  id, name, category: 'Pantry', status: 'have', count: null, staple: false, store: 'any', walmartItemId: null, packSize: null, stockUp: null,
  minPackages: 1, occasional: false, useBy: null, useByEstimated: false, lastsDays: null, portions: [], alsoCalled: [], ...extra,
});

export const recipe = (slug: string, lines: string[], extra: Partial<Recipe> = {}): Recipe => ({
  slug, title: slug, kind: 'recipe', meals: ['dinner'], serves: 4, time: null, tags: [], batch: false, seasons: [],
  source: null, image: null, claudesPick: false, nightBefore: null, summary: '', body: '',
  ingredients: lines.map(line => parseIngredientLine(line)!), ...extra,
});
