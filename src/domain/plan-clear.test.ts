import { describe, expect, it } from 'vitest';
import { clearedPlan } from './plan-clear.ts';
import { blankEntry, type PlanEntry } from './plan.ts';

const TODAY = '2026-11-04';
const LATER = '2026-11-05';
const dinner = (over: Partial<PlanEntry> = {}, date = TODAY): PlanEntry => ({ ...blankEntry(date, 'dinner'), kind: 'recipe', recipeSlug: 'soup', ...over });
const removedFrom = (entries: PlanEntry[]) => clearedPlan(entries, TODAY).removed;

describe('what clearing the plan takes off', () => {
  it('takes today’s and later meals and extras, pinned or not', () => {
    const entries = [dinner(), dinner({ pinned: true }, LATER), { ...dinner({}, LATER), slot: 'extra-3' as const }];
    expect(removedFrom(entries)).toEqual(entries);
  });
  it('leaves past days, even with no outcome', () => {
    expect(removedFrom([dinner({}, '2026-11-03')])).toEqual([]);
  });
  it.each(['made', 'swapped', 'skipped'] as const)('leaves a meal recorded as %s', outcome => {
    expect(removedFrom([dinner({ outcome })])).toEqual([]);
  });
  it('leaves a meal that came off the pantry and was unticked after', () => {
    expect(removedFrom([dinner({ pantrySettled: true }), dinner({ checkinSettled: true })])).toEqual([]);
  });
});

describe('leftovers of a meal coming off', () => {
  const source = { date: TODAY, slot: 'dinner' as const };
  const lunch: PlanEntry = { ...blankEntry(LATER, 'lunch'), kind: 'leftovers', leftoversOf: source };

  it('go with it', () => {
    const { removed, withoutSource } = clearedPlan([dinner(), lunch], TODAY);
    expect(removed).toHaveLength(2);
    expect(withoutSource).toEqual([]);
  });
  it('lose their source if they’re staying', () => {
    const kept = { ...lunch, checkinSettled: true };
    expect(clearedPlan([dinner(), kept], TODAY).withoutSource).toEqual([{ ...kept, leftoversOf: null }]);
  });
  it('keep their source when the dinner stays', () => {
    const kept = { ...lunch, checkinSettled: true };
    expect(clearedPlan([dinner({ outcome: 'made' }), kept], TODAY).withoutSource).toEqual([]);
  });
});
