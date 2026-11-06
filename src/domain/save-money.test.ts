import { describe, expect, it } from 'vitest';
import type { PlanEntry } from './plan.ts';
import { savedTogether, swapIdeas, type SaveMoneyInput } from './save-money.ts';
import { pantryItem, recipe } from './test-fixtures.ts';

describe('saving money', () => {
  const planned = (date: string, slug: string) => ({ date, slot: 'dinner', kind: 'recipe', recipeSlug: slug, multiplier: 1, outcome: null, outcomeSlug: null, note: null, leftoversOf: null, drafted: null }) as unknown as PlanEntry;
  const pantry = [
    pantryItem(1, 'steak', { status: 'out', occasional: true }), pantryItem(2, 'beans'), pantryItem(3, 'saffron', { status: 'out', occasional: true }), pantryItem(4, 'rice', { status: 'out', occasional: true }),
  ];
  const cost: Record<string, number | null> = { steak: 2000, rice: 300, saffron: null };
  const recipes = new Map([
    ['steak', recipe('steak', ['- 1 steak'])], ['beans', recipe('beans', ['- 1 cup beans'])], ['fancy', recipe('fancy', ['- 1 tsp saffron'])], ['rice', recipe('rice', ['- 1 cup rice'])],
  ]);
  const input = (extra: Partial<SaveMoneyInput> = {}): SaveMoneyInput => ({
    entries: [planned('2026-11-06', 'steak')], recipes, pantry, weekStore: 'walmart', from: '2026-11-05', to: '2026-11-10', today: '2026-11-05',
    lineCents: line => cost[line.name] ?? null, canCook: () => true, multiplierFor: () => 1, ...extra,
  });

  it('offers the swap that takes the most off the list, and says if it is ready', () => {
    const [idea] = swapIdeas(input());
    expect(idea).toMatchObject({ fromTitle: 'steak', toSlug: 'beans', savedCents: 2000, fewerItems: 1, ready: true });
  });
  it('will not call something with no price a saving', () => {
    const only = new Map([['steak', recipes.get('steak')!], ['fancy', recipes.get('fancy')!]]);
    expect(swapIdeas(input({ recipes: only }))).toEqual([]);
  });
  it('leaves alone what is done, past, or would not fit', () => {
    expect(swapIdeas(input({ entries: [{ ...planned('2026-11-06', 'steak'), outcome: 'made' }] }))).toEqual([]);
    expect(swapIdeas(input({ today: '2026-11-07' }))).toEqual([]);
    expect(swapIdeas(input({ canCook: () => false }))).toEqual([]);
  });
  it('does not fill the week with one dinner', () => {
    const entries = [planned('2026-11-06', 'steak'), planned('2026-11-07', 'beans'), planned('2026-11-08', 'beans')];
    expect(swapIdeas(input({ entries })).map(i => i.toSlug)).not.toContain('beans');
  });
  it('counts one fewer package of something a repeated meal still needs', () => {
    const packets = new Map([['tacos', recipe('tacos', ['- 1 package seasoning'])], ['beans', recipes.get('beans')!]]);
    const stock = [pantryItem(5, 'seasoning', { status: 'out', occasional: true, walmartItemId: '5', packSize: { count: 1, measure: null } }), pantryItem(2, 'beans')];
    const [idea] = swapIdeas(input({ recipes: packets, pantry: stock, entries: [planned('2026-11-06', 'tacos'), planned('2026-11-07', 'tacos')], lineCents: () => null }));
    expect(idea).toMatchObject({ toSlug: 'beans', savedCents: 0, fewerItems: 1 });
  });
  it('counts shared ingredients once when swaps are taken together', () => {
    const entries = [planned('2026-11-06', 'steak'), planned('2026-11-07', 'steak')];
    const one = { slot: 'dinner' as const, toSlug: 'beans', multiplier: 1 };
    expect(savedTogether(input({ entries }), [{ ...one, date: '2026-11-06' }]).savedCents).toBe(0);
    expect(savedTogether(input({ entries }), [{ ...one, date: '2026-11-06' }, { ...one, date: '2026-11-07' }]).savedCents).toBe(2000);
  });
});
