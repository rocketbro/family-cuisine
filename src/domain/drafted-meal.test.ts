import { describe, expect, it } from 'vitest';
import { checkinQuestions } from './checkin.ts';
import { expectedUses, matchUses, patchAfterUse, usesText, type MealUse } from './drafted-meal.ts';
import type { PantryItem } from './pantry.ts';

describe('drafted meals', () => {
  const base = { category: 'Other', staple: false, store: 'any', walmartItemId: null, packSize: null, stockUp: null, minPackages: 1, occasional: false, useBy: null, useByEstimated: false, lastsDays: null, portions: [], alsoCalled: [] };
  const bread = { ...base, id: 1, name: 'garlic bread', status: 'have', count: null } as PantryItem;
  const eggs = { ...base, id: 2, name: 'eggs', status: 'have', count: 12 } as PantryItem;
  const gone = { ...base, id: 3, name: 'rice', status: 'out', count: null } as PantryItem;
  const chicken = { ...base, id: 4, name: 'chicken', status: 'have', count: null, portions: [
    { storage: 'fresh', amount: 1, unit: 'lb', canOz: null, useBy: null, useByEstimated: false },
    { storage: 'frozen', amount: 3, unit: 'lb', canOz: null, useBy: null, useByEstimated: false },
  ] } as PantryItem;
  const use = (over: Partial<MealUse>): MealUse => ({ pantryItemId: 1, name: 'x', text: '1', amount: null, unit: null, leaves: 'have', ...over });

  it('keeps only items in the house, once each, and forgets a measure it does not know', () => {
    const uses = matchUses([
      { pantryName: 'garlic bread', text: '1 loaf', amount: 1, unit: 'loaf', leaves: 'out' },
      { pantryName: 'Garlic Bread', text: 'again', amount: 1, unit: null, leaves: 'have' },
      { pantryName: 'rice', text: '1 cup', amount: 1, unit: 'cup', leaves: 'have' },
      { pantryName: 'caviar', text: '1 tin', amount: 1, unit: null, leaves: 'have' },
      { pantryName: 'chicken', text: '2 lb chicken', amount: 2, unit: 'lb', leaves: 'have' },
    ], [bread, gone, chicken]);
    expect(uses.map(u => [u.name, u.amount, u.unit])).toEqual([['garlic bread', null, null], ['chicken', 2, 'lb']]);
    expect(usesText(uses)).toBe('1 loaf garlic bread, 2 lb chicken');
  });

  it('settles only a draft they ate as planned', () => {
    const drafted = { how: null, uses: [use({})] };
    expect(expectedUses({ outcome: 'made', drafted })).toHaveLength(1);
    expect(expectedUses({ outcome: 'swapped', drafted })).toEqual([]);
    expect(expectedUses({ outcome: null, drafted })).toEqual([]);
  });

  it('takes measured amounts down and leaves the rest to the answer', () => {
    const pounds = use({ amount: 2, unit: 'lb' });
    expect(patchAfterUse(chicken, pounds, 'have')).toEqual({ portions: [{ storage: 'fresh', amount: 0, unit: 'lb' }, { storage: 'frozen', amount: 2, unit: 'lb' }] });
    expect(patchAfterUse(chicken, pounds, 'out')).toEqual({ status: 'out' });
    expect(patchAfterUse(chicken, pounds, 'unused')).toBeNull();
    expect(patchAfterUse(bread, use({}), 'out')).toEqual({ status: 'out' });
    expect(patchAfterUse(eggs, use({ amount: 4 }), 'have')).toEqual({ count: 8 });
    expect(patchAfterUse(eggs, use({ amount: 4 }), 'low')).toEqual({ count: 2 });
    expect(patchAfterUse(eggs, use({ amount: 4 }), 'out')).toEqual({ count: 0 });
  });

  it('asks about a draft once, with what the model expected already chosen', () => {
    const entry = { date: '2026-11-04', slot: 'dinner' as const, kind: 'note' as const, recipeSlug: null, multiplier: 1, leftoversOf: null, note: 'Chicken and bread', outcome: 'made' as const, outcomeSlug: null, pantrySettled: false, checkinSettled: false, substituted: null, pinned: true,
      drafted: { how: null, uses: [use({ name: 'garlic bread', text: '1 loaf', leaves: 'out' }), use({ pantryItemId: 3, name: 'rice' })] } };
    const q = checkinQuestions([entry], '2026-11-04', new Map(), [bread, gone]);
    expect(q.uses).toEqual([{ date: '2026-11-04', slot: 'dinner', pantryItemId: 1, name: 'garlic bread', text: '1 loaf', answer: 'out' }]);
  });
});
