import { describe, expect, it } from 'vitest';
import { checkinLeftToAsk } from './checkin-open.ts';
import { blankEntry, type PlanEntry } from './plan.ts';
import type { PlanSlot } from './plan-slot.ts';
import { pantryItem, recipe } from './test-fixtures.ts';

const DAY = '2026-11-04';
const pantry = [pantryItem(1, 'rice'), pantryItem(2, 'bread')];
const recipes = new Map([
  ['stew', recipe('stew', ['- 1 cup rice'])],
  ['toast', recipe('toast', ['- 2 slices bread'])],
  ['water', recipe('water', ['- 1 cup tap water'])],
]);
const meal = (slot: PlanSlot, slug: string, over: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(DAY, slot), kind: 'recipe', recipeSlug: slug, ...over });
const left = (meals: PlanEntry[], anyLeft?: 'some' | 'none') => checkinLeftToAsk(meals, DAY, recipes, pantry, anyLeft);

describe('whether the check-in has anything left to ask', () => {
  it('asks about a meal nobody has marked', () => {
    expect(left([meal('dinner', 'stew', { outcome: 'made', checkinSettled: true }), meal('lunch', 'water')])).toBe(true);
  });

  it('asks about extras nobody has marked too', () => {
    expect(left([meal('extra-1', 'water')])).toBe(true);
  });

  it('asks the pantry questions of a meal marked made but not settled', () => {
    expect(left([meal('lunch', 'toast', { outcome: 'made' })])).toBe(true);
  });

  it('asks any left of a dinner that was made, until someone answers', () => {
    const dinner = meal('dinner', 'water', { outcome: 'made' });
    expect(left([dinner])).toBe(true);
    expect(left([dinner], 'none')).toBe(false);
    expect(left([dinner], 'some')).toBe(false);
  });

  it('has nothing left when every meal is marked and settled and the dinner answered', () => {
    expect(left([meal('lunch', 'toast', { outcome: 'made', checkinSettled: true }), meal('dinner', 'stew', { outcome: 'made', checkinSettled: true })], 'some')).toBe(false);
  });

  it('has nothing left for meals cook mode settled', () => {
    expect(left([meal('lunch', 'toast', { outcome: 'made', pantrySettled: true })])).toBe(false);
  });

  it('does not ask about skipped meals, or any left of leftovers', () => {
    const leftovers: PlanEntry = { ...blankEntry(DAY, 'dinner'), kind: 'leftovers', outcome: 'made' };
    expect(left([meal('lunch', 'toast', { outcome: 'skipped' }), leftovers])).toBe(false);
  });

  it('has nothing to mark when nothing was planned', () => {
    expect(left([])).toBe(false);
  });
});
