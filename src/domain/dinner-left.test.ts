import { describe, expect, it } from 'vitest';
import { asksAnyLeft, offersLeftovers } from './dinner-left.ts';
import { blankEntry, type PlanEntry } from './plan.ts';

const dinner = (over: Partial<PlanEntry>): PlanEntry => ({ ...blankEntry('2026-11-03', 'dinner'), ...over });
const fromTheBook = dinner({ kind: 'recipe', recipeSlug: 'chili', outcome: 'made' });
const onlyAName = dinner({ kind: 'note', note: 'Eating out', outcome: 'made' });

describe('asking whether any dinner is left', () => {
  it('asks about a dinner that was eaten, as planned or not', () => {
    expect(asksAnyLeft([fromTheBook])).toBe(true);
    expect(asksAnyLeft([dinner({ kind: 'note', note: 'Tacos', outcome: 'swapped' })])).toBe(true);
  });

  it('doesn’t ask about a skipped dinner, an unmarked one, leftovers or lunch', () => {
    expect(asksAnyLeft([{ ...fromTheBook, outcome: 'skipped' }])).toBe(false);
    expect(asksAnyLeft([{ ...fromTheBook, outcome: null }])).toBe(false);
    expect(asksAnyLeft([dinner({ kind: 'leftovers', outcome: 'made' })])).toBe(false);
    expect(asksAnyLeft([{ ...fromTheBook, slot: 'lunch' }])).toBe(false);
  });
});

describe('offering a dinner as leftovers', () => {
  it('goes by the answer once there is one', () => {
    expect(offersLeftovers(fromTheBook, 'Chili', 'none')).toBe(false);
    expect(offersLeftovers(onlyAName, 'Tacos', 'some')).toBe(true);
  });

  it('assumes a dinner from the book left some, but not one that’s only a name', () => {
    expect(offersLeftovers(fromTheBook, 'Chili', undefined)).toBe(true);
    expect(offersLeftovers(onlyAName, 'Eating out', undefined)).toBe(false);
  });

  it('never offers a meal that wasn’t made, whatever was said', () => {
    expect(offersLeftovers({ ...fromTheBook, outcome: 'skipped' }, null, 'some')).toBe(false);
  });
});
