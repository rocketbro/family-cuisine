import { describe, expect, it } from 'vitest';
import { clashGroups, saveBlocker, chooseMeal, withoutMeal, type ReviewedMeal } from './plan-import-choices.ts';
import { firstChangedDate } from './plan-import-choices.ts';

const DAY = '2026-11-07';
const meal = (key: number, over: Partial<ReviewedMeal> = {}): ReviewedMeal => ({ key, date: DAY, slot: 'dinner', ...over });

describe('two meals in one slot', () => {
  it('groups only what shares a date and slot', () => {
    const meals = [meal(1), meal(2), meal(3, { slot: 'lunch' }), meal(4, { date: '2026-11-08' })];
    expect(clashGroups(meals).map(group => group.map(m => m.key))).toEqual([[1, 2]]);
  });

  it('lets extras pile up, and doesn’t group meals with no day', () => {
    expect(clashGroups([meal(1, { slot: 'extra' }), meal(2, { slot: 'extra' }), meal(3, { date: null }), meal(4, { date: null })])).toEqual([]);
  });

  it('“Use this” removes the others in that slot and nothing else', () => {
    const meals = [meal(1), meal(2), meal(3), meal(4, { slot: 'lunch' }), meal(5, { date: '2026-11-08' }), meal(6, { slot: 'extra' })];
    expect(chooseMeal(meals, 2).map(m => m.key)).toEqual([2, 4, 5, 6]);
    expect(clashGroups(chooseMeal(meals, 2))).toEqual([]);
  });

  it('“Use this” leaves other extras and no-day meals alone', () => {
    const extras = [meal(1, { slot: 'extra' }), meal(2, { slot: 'extra' })];
    expect(chooseMeal(extras, 1)).toEqual(extras);
    const noDay = [meal(1, { date: null }), meal(2, { date: null })];
    expect(chooseMeal(noDay, 1)).toEqual(noDay);
  });

  it('“Use this” changes nothing for a meal that’s gone', () => {
    expect(chooseMeal([meal(1), meal(2)], 9).map(m => m.key)).toEqual([1, 2]);
  });
});

describe('keeping what’s already planned', () => {
  it('removes only the imported meal', () => {
    expect(withoutMeal([meal(1), meal(2, { slot: 'lunch' })], 1).map(m => m.key)).toEqual([2]);
  });
});

describe('what stops a save', () => {
  it('nothing, once every meal has its own slot and day', () => {
    const meals = [meal(1), meal(2, { slot: 'lunch' })];
    expect(saveBlocker(meals, meals)).toBeNull();
  });

  it('a clash first, naming where', () => {
    const meals = [meal(1, { date: null }), meal(2), meal(3)];
    expect(saveBlocker(meals.slice(1), meals)).toEqual({ kind: 'clash', date: DAY, slot: 'dinner' });
  });

  it('a meal with no day', () => {
    const meals = [meal(1), meal(2, { date: null }), meal(3, { date: null })];
    expect(saveBlocker(meals.slice(0, 1), meals)).toEqual({ kind: 'no-day', count: 2 });
  });

  it('having nothing left to save', () => {
    expect(saveBlocker([], [])).toEqual({ kind: 'nothing' });
  });

  it('not a clash nobody can save anyway, like two meals on a day gone by', () => {
    const past = [meal(1, { date: '2026-11-01' }), meal(2, { date: '2026-11-01' })];
    const coming = meal(3);
    expect(saveBlocker([coming], [...past, coming])).toBeNull();
  });
});

describe('the first day a change touched', () => {
  const meal = (date: string | null, name: string) => ({ said: name, date, slot: 'dinner' as const, match: { kind: 'named' as const, name }, confidence: 'sure' as const });
  it('finds both ends of a move, and the earlier one first', () => {
    expect(firstChangedDate([meal('2026-11-09', 'Chili')], [meal('2026-11-07', 'Chili')])).toBe('2026-11-07');
  });
  it('finds a meal added or taken off', () => {
    expect(firstChangedDate([], [meal('2026-11-08', 'Soup')])).toBe('2026-11-08');
    expect(firstChangedDate([meal('2026-11-08', 'Soup')], [])).toBe('2026-11-08');
  });
  it('is null when nothing changed', () => {
    expect(firstChangedDate([meal('2026-11-08', 'Soup')], [meal('2026-11-08', 'Soup')])).toBeNull();
  });
});
