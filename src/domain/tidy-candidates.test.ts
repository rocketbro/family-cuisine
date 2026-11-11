import { describe, expect, it } from 'vitest';
import { blankEntry, type PlanEntry } from './plan.ts';
import { pantryItem, recipe } from './test-fixtures.ts';
import { tidyCandidates } from './tidy-candidates.ts';
import { likelyDuplicates, looksLikeSame } from './tidy-duplicates.ts';
import { TODAY, tidyInputs } from './tidy-fixtures.ts';
import { unconfirmedLeftovers } from './tidy-leftovers.ts';
import { closeNames, unmatchedIngredients } from './tidy-recipe-names.ts';
import { implausibleCounts, longPastUseBy, lowButBought } from './tidy-stock.ts';

describe('items that may be the same thing', () => {
  it('reads a name that ends another as the same, by words', () => {
    expect(looksLikeSame('rolled oats', 'Old-fashioned rolled oat')).toBe(true);
    expect(looksLikeSame('oats', 'oat milk')).toBe(false);
    expect(looksLikeSame('', 'oats')).toBe(false);
  });

  it('pairs items in one category, with each one’s details', () => {
    const pantry = [pantryItem(1, 'rolled oats', { alsoCalled: ['oatmeal'] }), pantryItem(2, 'Old-fashioned rolled oats'), pantryItem(3, 'oat milk')];
    const [found, ...rest] = likelyDuplicates(tidyInputs({ pantry }));
    expect(rest).toEqual([]);
    expect(found.fingerprint).toBe('duplicate:1:2');
    expect(found.allowed).toEqual(['merge_items', 'add_other_name']);
    expect(found.evidence[0]).toContain('also called oatmeal');
    expect(found.scope.names).toEqual(['rolled oats', 'Old-fashioned rolled oats']);
  });

  it('ignores a pair in different categories, and will not merge items kept in portions', () => {
    expect(likelyDuplicates(tidyInputs({ pantry: [pantryItem(1, 'oats'), pantryItem(2, 'rolled oats', { category: 'Baking' })] }))).toEqual([]);
    const withPortions = pantryItem(2, 'rolled oats', { portions: [{ storage: 'fresh', amount: 1, unit: 'lb', useBy: null, canOz: null } as never] });
    expect(likelyDuplicates(tidyInputs({ pantry: [pantryItem(1, 'oats'), withPortions] }))[0].allowed).toEqual(['add_other_name']);
  });
});

describe('a date long gone on something in the house', () => {
  it('flags one more than a week past, not recent or out', () => {
    const pantry = [
      pantryItem(1, 'Yogurt', { useBy: '2026-11-01' }), pantryItem(2, 'Milk', { useBy: '2026-11-08' }),
      pantryItem(3, 'Cheese', { useBy: '2026-10-01', status: 'out' }), pantryItem(4, 'Butter', { useBy: '2026-11-30' }),
    ];
    const found = longPastUseBy(tidyInputs({ pantry }));
    expect(found.map(c => c.fingerprint)).toEqual(['use-by:1:2026-11-01']);
    expect(found[0].allowed).toEqual(['clear_use_by', 'set_status']);
    expect(found[0].scope.statuses).toEqual(['out']);
  });
});

describe('a count that is too big to be right', () => {
  it('flags four dozen or more', () => {
    const pantry = [pantryItem(1, 'Eggs', { count: 60 }), pantryItem(2, 'Cans', { count: 12 }), pantryItem(3, 'Salt')];
    expect(implausibleCounts(tidyInputs({ pantry })).map(c => c.fingerprint)).toEqual(['count:1:60']);
  });
});

describe('low or out, yet bought every time', () => {
  const trip = (shopDate: string, ids: number[]) => ({ shopDate, onList: ids, bought: ids });

  it('flags an item on the list and a receipt for three trips running', () => {
    const pantry = [pantryItem(1, 'Bread', { status: 'low' }), pantryItem(2, 'Eggs', { status: 'out' })];
    const trips = [trip('2026-11-10', [1, 2]), trip('2026-11-03', [1]), trip('2026-10-27', [1, 2])];
    expect(lowButBought(tidyInputs({ pantry, trips })).map(c => c.fingerprint)).toEqual(['bought-low:1']);
  });

  it('needs three trips on record, and an item that is not in the house', () => {
    const pantry = [pantryItem(1, 'Bread', { status: 'low' })];
    expect(lowButBought(tidyInputs({ pantry, trips: [trip('2026-11-10', [1]), trip('2026-11-03', [1])] }))).toEqual([]);
    const have = [pantryItem(1, 'Bread')];
    expect(lowButBought(tidyInputs({ pantry: have, trips: [trip('a', [1]), trip('b', [1]), trip('c', [1])] }))).toEqual([]);
  });
});

describe('a recipe name that matches nothing in the pantry', () => {
  it('flags it with the close pantry name, once for all the recipes that write it', () => {
    const recipes = [recipe('a', ['- 2 cups scallions'], { title: 'Fried rice' }), recipe('b', ['- scallions, sliced'], { title: 'Noodles' })];
    const pantry = [pantryItem(1, 'scallion bunch'), pantryItem(2, 'flour')];
    const [found, ...rest] = unmatchedIngredients(tidyInputs({ pantry, recipes }));
    expect(rest).toEqual([]);
    expect(found.evidence[0]).toContain('Fried rice; Noodles');
    expect(found.scope.items).toEqual([{ id: 1, name: 'scallion bunch' }]);
    expect(found.scope.names).toEqual(['scallions']);
  });

  it('says nothing when the pantry already resolves the name, or nothing is close', () => {
    const recipes = [recipe('a', ['- flour', '- saffron'])];
    expect(unmatchedIngredients(tidyInputs({ pantry: [pantryItem(1, 'flour')], recipes }))).toEqual([]);
  });

  it('counts a spelling slip as close', () => {
    expect(closeNames('tomatos', 'tomatoes')).toBe(true);
    expect(closeNames('butter', 'peanut butter')).toBe(true);
    expect(closeNames('pepper', 'flour')).toBe(false);
  });
});

describe('leftovers of a dinner nobody marked', () => {
  const dinner: PlanEntry = { ...blankEntry('2026-11-11', 'dinner'), kind: 'recipe', recipeSlug: 'soup' };
  const leftovers: PlanEntry = { ...blankEntry('2026-11-13', 'lunch'), kind: 'leftovers', leftoversOf: { date: '2026-11-11', slot: 'dinner' } };
  const recipes = [recipe('soup', [], { title: 'Bean soup' })];

  it('asks about planned leftovers whose dinner is past and unmarked', () => {
    const [found] = unconfirmedLeftovers(tidyInputs({ plan: [dinner, leftovers], recipes }));
    expect(found.fingerprint).toBe('leftovers:2026-11-13:lunch');
    expect(found.evidence[0]).toContain('Bean soup');
    expect(found.allowed).toEqual(['remove_plan_entry']);
  });

  it('does not once the dinner is marked, or if the dinner is still ahead', () => {
    expect(unconfirmedLeftovers(tidyInputs({ plan: [{ ...dinner, outcome: 'made' }, leftovers], recipes }))).toEqual([]);
    expect(unconfirmedLeftovers(tidyInputs({ plan: [{ ...dinner, date: TODAY }, { ...leftovers, leftoversOf: { date: TODAY, slot: 'dinner' } }], recipes }))).toEqual([]);
  });
});

describe('all the candidates together', () => {
  const pantry = [pantryItem(1, 'oats'), pantryItem(2, 'rolled oats'), ...Array.from({ length: 8 }, (_, i) => pantryItem(10 + i, `item ${i}`, { count: 50 + i }))];

  it('leaves out what was asked lately', () => {
    const all = tidyCandidates(tidyInputs({ pantry }), new Set());
    expect(all.some(c => c.fingerprint === 'duplicate:1:2')).toBe(true);
    expect(tidyCandidates(tidyInputs({ pantry }), new Set(['duplicate:1:2'])).some(c => c.fingerprint === 'duplicate:1:2')).toBe(false);
  });

  it('caps each kind', () => {
    expect(tidyCandidates(tidyInputs({ pantry }), new Set()).filter(c => c.kind === 'odd_count')).toHaveLength(6);
    expect(tidyCandidates(tidyInputs({ pantry }), new Set(), Infinity).filter(c => c.kind === 'odd_count')).toHaveLength(8);
  });
});
