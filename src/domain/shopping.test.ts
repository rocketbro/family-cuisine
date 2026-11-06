import { describe, expect, it } from 'vitest';
import { blankEntry, type PlanEntry } from './plan.ts';
import { isEstimate, lineCents, needsLookup, packsFromProducts } from './prices.ts';
import type { MealSlot } from './recipe.ts';
import { buildShoppingList } from './shopping.ts';
import { pantryItem, recipe } from './test-fixtures.ts';

describe('shopping and check-in: the list', () => {
  const pantry = [
    pantryItem(1, 'eggs', { count: 3 }), pantryItem(2, 'peanut butter', { walmartItemId: '10314928', store: 'walmart', status: 'low' }),
    pantryItem(3, 'bread'), pantryItem(4, 'jelly', { status: 'out' }), pantryItem(5, 'coffee', { status: 'out' }),
  ];
  const recipes = new Map([
    ['eggs', recipe('eggs', ['- 2 eggs', '- 2 slices bread'], { meals: ['breakfast'] })],
    ['pbj', recipe('pbj', ['- 4 slices bread', '- 2 tbsp peanut butter', '- 2 tbsp jelly', '- 1 banana'], { meals: ['lunch'] })],
  ]);
  const meal = (date: string, slot: MealSlot, recipeSlug: string): PlanEntry => ({ ...blankEntry(date, slot), kind: 'recipe', recipeSlug });
  const entries = [meal('2026-11-04', 'breakfast', 'eggs'), meal('2026-11-05', 'breakfast', 'eggs'), meal('2026-11-04', 'lunch', 'pbj')];
  it('lists what the week needs, by store', () => {
    const list = buildShoppingList({ entries, recipes, pantry, weekStore: 'aldi', from: '2026-11-04', to: '2026-11-10' });
    const by = (name: string) => list.find(l => l.name === name);
    expect(by('eggs')?.quantity).toBe(1);
    expect(by('peanut butter')?.store).toBe('walmart');
    expect(by('jelly')?.reason).toBe('needed');
    expect(by('banana')?.reason).toBe('unknown');
    expect(by('coffee')?.reason).toBe('restock');
    expect(by('bread')).toBeUndefined();
  });
  it('leaves occasional items off the list unless a recipe needs them', () => {
    const stock = [pantryItem(1, 'jelly', { status: 'out', occasional: true }), pantryItem(2, 'capers', { status: 'out', occasional: true })];
    const list = buildShoppingList({ entries: entries.slice(2), recipes, pantry: stock, weekStore: 'aldi', from: '2026-11-04', to: '2026-11-10' });
    expect(list.find(l => l.name === 'jelly')?.reason).toBe('needed');
    expect(list.find(l => l.name === 'capers')).toBeUndefined();
  });
  it('carries the Walmart cart quantity onto the line', () => {
    const stock = [pantryItem(1, 'bananas', { status: 'low', walmartItemId: '44390948', minPackages: 5 })];
    const list = buildShoppingList({ entries: [], recipes, pantry: stock, weekStore: 'walmart', from: '2026-11-04', to: '2026-11-10' });
    expect(list[0].packages).toBe(5);
  });
});

describe('cart quantities on the list', () => {
  const week = { from: '2026-11-05', to: '2026-11-10', weekStore: 'walmart' as const };
  const planned = (slug: string, multiplier = 1) => ({ date: '2026-11-06', slot: 'dinner', kind: 'recipe', recipeSlug: slug, multiplier, outcome: null, outcomeSlug: null }) as unknown as PlanEntry;
  it('covers the week\u2019s eggs and keeps the item\u2019s minimum', () => {
    const recipes = new Map([['a', recipe('a', ['- 28 eggs'])], ['b', recipe('b', ['- 2 bananas'])]]);
    const pantry = [
      pantryItem(1, 'eggs', { count: 9, status: 'low', walmartItemId: '1', packSize: { count: 18, measure: null } }),
      pantryItem(2, 'bananas', { status: 'out', walmartItemId: '2', minPackages: 5, packSize: { count: 1, measure: null } }),
    ];
    const lines = buildShoppingList({ ...week, entries: [planned('a'), planned('b')], recipes, pantry });
    expect(lines.find(l => l.name === 'eggs')?.packages).toBe(2);
    expect(lines.find(l => l.name === 'bananas')?.packages).toBe(5);
  });
  it('says so when the product\u2019s size is unknown', () => {
    const recipes = new Map([['a', recipe('a', ['- 8 lb flour'])]]);
    const pantry = [pantryItem(1, 'flour', { status: 'out', walmartItemId: '1' })];
    const line = buildShoppingList({ ...week, entries: [planned('a')], recipes, pantry })[0];
    expect(line.packages).toBe(1);
    expect(line.sizeUnknown).toBe(true);
  });
  describe('at Aldi', () => {
    const aldiWeek = { ...week, weekStore: 'aldi' as const };
    const flour = (lb: number) => new Map([['a', recipe('a', [`- ${lb} lb flour`])]]);
    const out = (over = {}) => [pantryItem(1, 'flour', { status: 'out', ...over })];
    const priced = (product: string | null) => new Map([[1, { product }]]);

    it('counts packages from Aldi’s own product size, with no Walmart link', () => {
      const line = buildShoppingList({ ...aldiWeek, entries: [planned('a')], recipes: flour(8), pantry: out(), productPacks: { aldi: packsFromProducts(priced('Baker’s Corner All Purpose Flour, 5 lb')) } })[0];
      expect(line.packages).toBe(2);
      expect(lineCents(line, { cents: 185 })).toBe(370);
    });
    it('prefers Aldi’s size to Walmart’s', () => {
      const pantry = out({ packSize: { count: null, measure: { amount: 10, unit: 'lb' } } });
      const line = buildShoppingList({ ...aldiWeek, entries: [planned('a')], recipes: flour(8), pantry, productPacks: { aldi: packsFromProducts(priced('Flour, 5 lb')) } })[0];
      expect(line.packages).toBe(2);
    });
    it('falls back on the Walmart size, as with a typed price', () => {
      const pantry = out({ packSize: { count: null, measure: { amount: 5, unit: 'lb' } } });
      const line = buildShoppingList({ ...aldiWeek, entries: [planned('a')], recipes: flour(8), pantry, productPacks: { aldi: packsFromProducts(priced(null)) } })[0];
      expect(line.packages).toBe(2);
    });
    it('counts packages sold by weight from their estimated size, and calls it an estimate', () => {
      const product = 'Kirkwood Chicken Thighs, about 1.85 lb / package';
      const recipes = new Map([['a', recipe('a', ['- 3 lb flour'])]]);
      const line = buildShoppingList({ ...aldiWeek, entries: [planned('a')], recipes, pantry: out(), productPacks: { aldi: packsFromProducts(priced(product)) } })[0];
      expect(line.packages).toBe(2);
      expect(isEstimate({ ...line, price: { product } })).toBe(true);
      expect(isEstimate({ ...line, price: { product: 'Flour, 5 lb' } })).toBe(false);
    });
    it('counts by-the-each produce sold by weight', () => {
      const recipes = new Map([['a', recipe('a', ['- 6 flour'])]]);
      const line = buildShoppingList({ ...aldiWeek, entries: [planned('a')], recipes, pantry: out(), productPacks: { aldi: packsFromProducts(priced('Bananas, about 0.33 lb each')) } })[0];
      expect(line.packages).toBe(6);
    });
    it('calls an unknown size an estimate', () => {
      const line = buildShoppingList({ ...aldiWeek, entries: [planned('a')], recipes: flour(8), pantry: out(), productPacks: { aldi: packsFromProducts(priced('Chicken Thighs')) } })[0];
      expect(line.packages).toBe(1);
      expect(line.sizeUnknown).toBe(true);
      expect(isEstimate(line)).toBe(true);
    });
    it('rechecks a by-weight price saved without its size', () => {
      const price = { cents: 664, source: 'lookup' as const, product: 'Chicken Thighs, per lb', checkedAt: new Date().toISOString() };
      expect(needsLookup(price, new Date())).toBe(true);
      expect(needsLookup({ ...price, product: 'Chicken Thighs, about 1.85 lb / package' }, new Date())).toBe(false);
    });
  });
});
