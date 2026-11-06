import { describe, expect, it } from 'vitest';
import { ingredientStock } from './availability.ts';
import { parseIngredientLine } from './ingredient.ts';
import { blankEntry } from './plan.ts';
import { portionsAfterCooking, shareNeeded } from './portion-amounts.ts';
import { mergePortions, portionsText, restocked, soonestDate, useSoonText, type Portion } from './portions.ts';
import { buildShoppingList } from './shopping.ts';
import { pantryItem, recipe } from './test-fixtures.ts';
import { goingOffSoon } from './use-by.ts';

describe('portions', () => {
  const today = '2026-11-04';
  const portion = (storage: Portion['storage'], amount: number | null, unit: Portion['unit'] = 'lb', useBy: string | null = null): Portion => ({ storage, amount, unit, canOz: null, useBy, useByEstimated: false });
  const beef = [portion('fresh', 1, 'lb', '2026-11-06'), portion('frozen', 5)];
  const stock = [pantryItem(1, 'ground beef', { portions: beef, useBy: '2026-11-06' })];
  const needs = (line: string) => parseIngredientLine(line)!;

  it('counts fresh and frozen together for a recipe', () => {
    expect(ingredientStock(needs('2 lb ground beef'), stock)).toBe('have');
    expect(ingredientStock(needs('4 lb ground beef'), stock, 2)).toBe('short');
    expect(ingredientStock(needs('32 oz ground beef'), stock)).toBe('have');
  });
  it('falls back to have / low / out when the measures can’t be compared', () => {
    expect(shareNeeded(beef, needs('2 cups ground beef'))).toBeNull();
    expect(shareNeeded([portion('frozen', null)], needs('1 lb ground beef'))).toBeNull();
    expect(ingredientStock(needs('2 cups ground beef'), stock)).toBe('have');
  });
  it('puts it on the list when the week’s meals add up to more than there is', () => {
    const chili = recipe('chili', ['- 4 lb ground beef']);
    const meal = (date: string) => ({ ...blankEntry(date, 'dinner'), kind: 'recipe' as const, recipeSlug: 'chili', multiplier: 1 });
    const list = (dates: string[]) => buildShoppingList({ entries: dates.map(meal), recipes: new Map([['chili', chili]]), pantry: stock, weekStore: 'aldi', from: '2026-11-04', to: '2026-11-10' });
    expect(list(['2026-11-05'])).toEqual([]);
    expect(list(['2026-11-05', '2026-11-06'])[0].name).toBe('ground beef');
  });
  it('takes what cooking used from fresh first', () => {
    expect(portionsAfterCooking(beef, needs('2 lb ground beef'))).toEqual([
      { storage: 'fresh', amount: 0, unit: 'lb' },
      { storage: 'frozen', amount: 4, unit: 'lb' },
    ]);
    expect(portionsAfterCooking([portion('fresh', null)], needs('2 lb ground beef'))).toEqual([]);
  });
  it('only changes the portions mentioned, and removes one at zero', () => {
    const kept = mergePortions(beef, [{ storage: 'frozen', amount: 3, unit: 'lb' }], { current: null }, today);
    expect(kept.map(p => [p.storage, p.amount, p.useBy])).toEqual([['fresh', 1, '2026-11-06'], ['frozen', 3, null]]);
    expect(mergePortions(beef, [{ storage: 'fresh', amount: 0, unit: 'lb' }], { current: null }, today).map(p => p.storage)).toEqual(['frozen']);
  });
  it('estimates a date for the fresh portion only', () => {
    const merged = mergePortions([], [{ storage: 'fresh', amount: 1, unit: 'lb' }, { storage: 'frozen', amount: 5, unit: 'lb' }], { current: null, changed: 2 }, today);
    expect(merged[0]).toMatchObject({ useBy: '2026-11-06', useByEstimated: true });
    expect(merged[1]).toMatchObject({ useBy: null, useByEstimated: false });
  });
  describe('canned and dried', () => {
    const cans = (amount: number, canOz: number | null = 15.5): Portion => ({ ...portion('canned', amount, 'can'), canOz });
    it('compares cans by count, or by ounces when the recipe gives a size', () => {
      expect(shareNeeded([cans(4)], needs('2 can kidney beans'))).toBe(0.5);
      expect(shareNeeded([cans(4)], needs('1 can kidney beans, 31 oz'))).toBeCloseTo(0.5);
      expect(shareNeeded([cans(4)], needs('31 oz kidney beans'))).toBeCloseTo(0.5);
      expect(shareNeeded([cans(1)], needs('2 can kidney beans'))).toBe(2);
    });
    it('uses an unlabelled can at the size the recipe asks for', () => {
      expect(shareNeeded([cans(2, null)], needs('1 can kidney beans, 15 oz'))).toBeCloseTo(0.5);
      expect(shareNeeded([cans(2, null)], needs('30 oz kidney beans'))).toBeNull();
    });
    it('treats near-enough can sizes as enough', () => {
      expect(shareNeeded([cans(1, 14.5)], needs('1 can black beans, 15 oz'))).toBe(1);
      expect(shareNeeded([cans(1, 14.5)], needs('1 can black beans, 28 oz'))).toBeGreaterThan(1);
    });
    it('counts dried beans toward cans at about four to the pound', () => {
      expect(shareNeeded([cans(1), portion('dried', 1)], needs('5 can black beans'))).toBe(1);
      expect(shareNeeded([portion('dried', 1)], needs('2 can black beans'))).toBeCloseTo(0.5);
    });
    it('reads a plain weight as dried when an item is kept both ways', () => {
      expect(shareNeeded([cans(4, 15), portion('dried', 1)], needs('1 lb black beans'))).toBeCloseTo(0.5);
      expect(shareNeeded([portion('dried', 2)], needs('1 lb dried black beans'))).toBeCloseTo(0.5);
    });
    it('takes whole cans off, and the form asked for first', () => {
      expect(portionsAfterCooking([cans(4)], needs('2 can kidney beans'))).toEqual([{ storage: 'canned', amount: 2, unit: 'can' }]);
      expect(portionsAfterCooking([cans(4, 14.5)], needs('1 can kidney beans, 15 oz'))).toEqual([{ storage: 'canned', amount: 3, unit: 'can' }]);
      expect(portionsAfterCooking([cans(4)], needs('20 oz kidney beans'))).toEqual([{ storage: 'canned', amount: 2, unit: 'can' }]);
      const both = [cans(1), portion('dried', 1)];
      expect(portionsAfterCooking(both, needs('2 can black beans'))).toEqual([{ storage: 'canned', amount: 0, unit: 'can' }, { storage: 'dried', amount: 0.75, unit: 'lb' }]);
      expect(portionsAfterCooking(both, needs('1 lb dried black beans'))).toEqual([{ storage: 'dried', amount: 0, unit: 'lb' }]);
    });
    it('keeps the can size through a change, and describes it', () => {
      const merged = mergePortions([cans(4)], [{ storage: 'canned', amount: 2, unit: 'can' }], { current: null }, today);
      expect(merged[0].canOz).toBe(15.5);
      expect(portionsText([cans(4), portion('dried', 2)])).toBe('4 × 15½ oz cans · 2 lb dried');
      expect(portionsText([cans(1, null)])).toBe('1 can');
    });
    it('gives shelf goods no date unless one was said', () => {
      const merged = mergePortions([], [{ storage: 'canned', amount: 2, unit: 'can' }], { current: null, changed: 5 }, today);
      expect(merged[0].useBy).toBeNull();
    });
    it('restocks the way it is bought, leaving the freezer alone', () => {
      expect(restocked([cans(1), portion('dried', 1)]).storage).toBe('canned');
      expect(restocked([portion('frozen', 5)])).toEqual({ storage: 'fresh', amount: null, unit: null });
    });
  });
  it('only reads as use soon because of the portion going off', () => {
    const frozenOnly = pantryItem(2, 'chicken thighs', { portions: [portion('frozen', 5)], ...soonestDate([portion('frozen', 5)]) });
    expect(goingOffSoon([...stock, frozenOnly], today).map(i => i.name)).toEqual(['ground beef']);
    expect(portionsText(beef)).toBe('1 lb fresh · 5 lb frozen');
  });

  it('tells the model what is going off, with the portion when one set the date', () => {
    const dated = { ...portion('fresh', 1), useBy: '2026-11-08' };
    expect(useSoonText({ name: 'ground beef', useBy: '2026-11-08', portions: [dated, portion('frozen', 5)] })).toBe('ground beef (1 lb fresh, by 2026-11-08)');
    expect(useSoonText({ name: 'milk', useBy: '2026-11-08', portions: [] })).toBe('milk (by 2026-11-08)');
  });
});
