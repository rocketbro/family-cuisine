import { describe, expect, it } from 'vitest';
import { ateSomethingElse, withMealMark } from './checkin-marks.ts';
import { blankEntry, cookedSlug, type PlanEntry } from './plan.ts';

const stew: PlanEntry = { ...blankEntry('2026-11-10', 'dinner'), kind: 'recipe', recipeSlug: 'stew' };

describe('marking a meal', () => {
  it('records Made, which cooks the plan', () => {
    const made = withMealMark(stew, { outcome: 'made' }, null);
    expect(made.outcome).toBe('made');
    expect(cookedSlug(made)).toBe('stew');
  });
  it('records Skipped, which cooks nothing', () => {
    expect(cookedSlug(withMealMark(stew, { outcome: 'skipped' }, null))).toBeNull();
  });
  it('records a typed name, which cooks nothing from the book', () => {
    const other = withMealMark(stew, { outcome: 'other', name: 'Red beans' }, null);
    expect(other).toMatchObject({ outcome: 'swapped', outcomeSlug: null, note: 'Red beans' });
    expect(cookedSlug(other)).toBeNull();
    expect(ateSomethingElse(other)).toBe(true);
  });
  it('changes on the next tap, with no typed name left behind', () => {
    const other = withMealMark(stew, { outcome: 'other', name: 'Red beans' }, null);
    expect(withMealMark(other, { outcome: 'made' }, null)).toMatchObject({ outcome: 'made', note: null });
    expect(withMealMark(other, { outcome: 'skipped' }, null)).toMatchObject({ outcome: 'skipped', note: null });
  });
  it('goes back to the name a meal was planned as', () => {
    const planned = { ...blankEntry('2026-11-10', 'dinner'), note: 'Pizza night' };
    const other = withMealMark(planned, { outcome: 'other', name: 'Tacos' }, 'Pizza night');
    expect(withMealMark(other, { outcome: 'made' }, 'Pizza night').note).toBe('Pizza night');
  });
  it('clears a recipe swap from what was cooked instead', () => {
    const cookedOther = { ...stew, outcome: 'swapped' as const, outcomeSlug: 'soup', substituted: { 0: 'oil' } };
    const made = withMealMark(cookedOther, { outcome: 'made' }, null);
    expect(made.outcomeSlug).toBeNull();
    expect(made.substituted).toBeNull();
    expect(ateSomethingElse(cookedOther)).toBe(false);
  });
  it('keeps the swaps of the dish that was made', () => {
    const done = { ...stew, outcome: 'made' as const, substituted: { 0: 'oil' } };
    expect(withMealMark(done, { outcome: 'made' }, null).substituted).toEqual({ 0: 'oil' });
  });
});
