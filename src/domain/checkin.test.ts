import { describe, expect, it } from 'vitest';
import { carriedMeals, checkinQuestions, mealsToSettle } from './checkin.ts';
import { blankEntry, type PlanEntry } from './plan.ts';
import type { MealSlot } from './recipe.ts';
import { pantryItem, recipe } from './test-fixtures.ts';

describe('what a check-in asks', () => {
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
  it('asks about counts and a few needs', () => {
    const q = checkinQuestions(entries, '2026-11-04', recipes, pantry);
    expect(q.counts).toEqual([{ pantryItemId: 1, name: 'eggs', estimate: 2, onHand: 3 }]);
    expect(q.needs.map(n => n.name)).toEqual(['peanut butter', 'bread']);
  });
  it('starts each need where the pantry stands, so Done doesn’t undo a low item', () => {
    const q = checkinQuestions(entries, '2026-11-04', recipes, pantry);
    expect(q.needs.find(n => n.name === 'peanut butter')?.answer).toBe('low');
    expect(q.needs.find(n => n.name === 'bread')?.answer).toBe('fine');
  });
  it('skips meals whose pantry cook mode already settled', () => {
    const settled = entries.map(e => ({ ...e, pantrySettled: e.slot === 'breakfast' }));
    const q = checkinQuestions(settled, '2026-11-04', recipes, pantry);
    expect(q.counts).toEqual([]);
  });
});

describe('what a check-in goes through', () => {
  const YESTERDAY = '2026-11-03';
  const TODAY = '2026-11-04';
  const cooked = (date: string, over: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(date, 'dinner'), kind: 'recipe', recipeSlug: 'stew', outcome: 'made', ...over });
  const stew = new Map([['stew', recipe('stew', ['- 2 eggs'])]]);
  const drafted = { how: null, uses: [{ pantryItemId: 1, name: 'eggs', text: '2', amount: 2, unit: null, leaves: 'have' as const }] };

  it('picks up an earlier meal that was cooked and never settled', () => {
    const late = cooked(YESTERDAY);
    expect(mealsToSettle([late], TODAY)).toEqual([late]);
    expect(carriedMeals([late], TODAY, stew)).toEqual([{ date: YESTERDAY, slot: 'dinner', title: 'stew' }]);
  });
  it('leaves earlier meals nobody cooked, or that are already settled', () => {
    expect(mealsToSettle([
      cooked(YESTERDAY, { outcome: null }),
      cooked(YESTERDAY, { outcome: 'skipped' }),
      cooked(YESTERDAY, { checkinSettled: true }),
      cooked(YESTERDAY, { pantrySettled: true }),
      { ...blankEntry(YESTERDAY, 'lunch'), note: 'Out for pizza', outcome: 'made' },
    ], TODAY)).toEqual([]);
  });
  it('still picks up a drafted meal’s uses after a saved review, since the review only covers the recipe', () => {
    const reviewed = cooked(YESTERDAY, { pantrySettled: true, drafted });
    expect(mealsToSettle([reviewed], TODAY)).toEqual([reviewed]);
  });
  it('doesn’t go through today’s meal again once a later check-in has', () => {
    expect(mealsToSettle([cooked(TODAY, { checkinSettled: true })], TODAY)).toEqual([]);
  });
  it('asks about an earlier meal together with today’s', () => {
    const q = checkinQuestions([cooked(YESTERDAY), cooked(TODAY)], TODAY, stew, [pantryItem(1, 'eggs', { count: 10 })]);
    expect(q.counts).toEqual([{ pantryItemId: 1, name: 'eggs', estimate: 4, onHand: 10 }]);
  });
  it('asks about what was swapped in, not what the recipe says', () => {
    const q = checkinQuestions([cooked(TODAY, { substituted: { 0: 'applesauce' } })], TODAY, stew, [pantryItem(1, 'eggs', { count: 10 }), pantryItem(2, 'applesauce')]);
    expect(q.counts).toEqual([]);
    expect(q.needs.map(n => n.name)).toEqual(['applesauce']);
  });
});
