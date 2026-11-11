import { describe, expect, it } from 'vitest';
import { daysToCatchUp, type CatchUpFacts } from './checkin-catch-up.ts';
import { addDays } from './dates.ts';
import { extraSlot } from './plan-slot.ts';
import { blankEntry, type PlanEntry } from './plan.ts';

const TODAY = '2026-11-12';
const meal = (date: string, over: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(date, 'dinner'), kind: 'recipe', recipeSlug: 'stew', ...over });
const facts = (over: Partial<CatchUpFacts> = {}): CatchUpFacts => ({ date: TODAY, today: TODAY, began: '2026-10-01', answered: () => false, ...over });
const yesterday = addDays(TODAY, -1);

describe('which earlier days to ask about', () => {
  it('asks about days with meals nobody marked, latest first, once each', () => {
    const entries = [meal('2026-11-09'), meal(yesterday), { ...meal(yesterday), slot: 'lunch' as const }];
    expect(daysToCatchUp(entries, facts())).toEqual([yesterday, '2026-11-09']);
  });
  it('asks about a day only partly marked', () => {
    expect(daysToCatchUp([meal(yesterday, { outcome: 'made' }), { ...meal(yesterday), slot: 'lunch' }], facts())).toEqual([yesterday]);
  });
  it('doesn’t ask about a day all marked', () => {
    expect(daysToCatchUp([meal(yesterday, { outcome: 'skipped' })], facts())).toEqual([]);
  });
  it('doesn’t ask about today, or a day ahead', () => {
    expect(daysToCatchUp([meal(TODAY), meal(addDays(TODAY, 1))], facts())).toEqual([]);
  });
  it('doesn’t ask when the check-in is for a day ahead', () => {
    expect(daysToCatchUp([meal(TODAY), meal(yesterday)], facts({ date: addDays(TODAY, 1) }))).toEqual([]);
  });
  it('reaches back as far as a check-in does, and no further', () => {
    const entries = [meal(addDays(TODAY, -7)), meal(addDays(TODAY, -8))];
    expect(daysToCatchUp(entries, facts())).toEqual([addDays(TODAY, -7)]);
  });
  it('never asks before the household started checking in', () => {
    expect(daysToCatchUp([meal(yesterday)], facts({ began: null }))).toEqual([]);
    expect(daysToCatchUp([meal('2026-11-09'), meal(yesterday)], facts({ began: '2026-11-10' }))).toEqual([yesterday]);
  });
  it('doesn’t ask twice once answered', () => {
    expect(daysToCatchUp([meal(yesterday)], facts({ answered: day => day === yesterday }))).toEqual([]);
  });
  it('doesn’t ask for an extra alone', () => {
    expect(daysToCatchUp([{ ...meal(yesterday), slot: extraSlot(1) }], facts())).toEqual([]);
  });
});
