import { describe, expect, it } from 'vitest';
import { blankEntry, cookedEntry, settledByCheckin, slotForHour, withMealDone } from './plan.ts';

describe('cooking', () => {
  const planned = { ...blankEntry('2026-11-04', 'dinner'), kind: 'recipe' as const, recipeSlug: 'soup', multiplier: 2 };
  it('counts the planned dish as made, at the size cooked', () => {
    expect(cookedEntry(planned, 'soup', 1)).toMatchObject({ outcome: 'made', outcomeSlug: null, multiplier: 1, pantrySettled: false });
  });
  it('leaves the pantry unsettled until its changes are saved', () => {
    const settled = { ...cookedEntry(planned, 'soup', 1), pantrySettled: true };
    expect(cookedEntry(settled, 'soup', 1).pantrySettled).toBe(true);
    expect(cookedEntry(settled, 'tacos', 1).pantrySettled).toBe(false);
  });
  it('counts anything else as a swap', () => {
    expect(cookedEntry(planned, 'tacos', 1)).toMatchObject({ outcome: 'swapped', outcomeSlug: 'tacos', recipeSlug: 'soup' });
  });
  it('picks the meal from the time of day', () => {
    expect([7, 12, 18.5].map(slotForHour)).toEqual(['breakfast', 'lunch', 'dinner']);
  });
});

describe('checking a meal off', () => {
  const dinner = { ...blankEntry('2026-11-05', 'dinner'), kind: 'recipe' as const, recipeSlug: 'tacos' };

  it('records it as made and can be undone', () => {
    const done = withMealDone(dinner, true);
    expect(done.outcome).toBe('made');
    expect(withMealDone(done, false).outcome).toBeNull();
  });

  it('leaves a recorded swap alone', () => {
    const swapped = { ...dinner, outcome: 'swapped' as const, outcomeSlug: 'soup' };
    expect(withMealDone(swapped, true)).toEqual(swapped);
    expect(withMealDone(swapped, false).outcomeSlug).toBeNull();
  });
});

describe('what a cooked meal remembers', () => {
  const planned = { ...blankEntry('2026-11-04', 'dinner'), kind: 'recipe' as const, recipeSlug: 'soup' };
  it('keeps the swaps it was cooked with, and none when there were none', () => {
    expect(cookedEntry(planned, 'soup', 1, { 0: 'flax-egg' }).substituted).toEqual({ 0: 'flax-egg' });
    expect(cookedEntry(planned, 'soup', 1, {}).substituted).toBeNull();
  });
  it('stays settled by the check-in only for the same dish', () => {
    const settled = { ...cookedEntry(planned, 'soup', 1), checkinSettled: true };
    expect(cookedEntry(settled, 'soup', 1).checkinSettled).toBe(true);
    expect(cookedEntry(settled, 'tacos', 1).checkinSettled).toBe(false);
    expect(settledByCheckin(settled, 'soup')).toBe(true);
    expect(settledByCheckin(settled, 'tacos')).toBe(false);
    expect(settledByCheckin(null, 'soup')).toBe(false);
  });
  it('forgets its swaps when it turns out it wasn’t made', () => {
    expect(withMealDone(cookedEntry(planned, 'soup', 1, { 0: 'flax-egg' }), false).substituted).toBeNull();
  });
});
