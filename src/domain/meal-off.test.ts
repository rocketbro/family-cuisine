import { describe, expect, it } from 'vitest';
import { mealOffLine, mealsOffNotice, mealsOffNoticeDue, remembered, stillOff, whyItCameOff, type MealOff } from './meal-off.ts';
import { blankEntry, type PlanEntry } from './plan.ts';

// 2026-11-10 is a Tuesday.
const TODAY = '2026-11-09';
const TUE = '2026-11-10';
const off = (over: Partial<MealOff> = {}): MealOff => ({
  date: TUE, slot: 'dinner', title: 'tacos', recipeSlug: 'tacos', multiplier: 1, why: 'no tortillas', told: false, ...over,
});
const entry = (over: Partial<PlanEntry>): PlanEntry => ({ ...blankEntry(TUE, 'dinner'), kind: 'recipe', recipeSlug: 'soup', ...over });

describe('when the notice can go', () => {
  const EIGHT = 8 * 60;
  it('waits for the plan time and stays quiet past the morning', () => {
    expect(mealsOffNoticeDue(EIGHT - 1, EIGHT)).toBe(false);
    expect(mealsOffNoticeDue(EIGHT, EIGHT)).toBe(true);
    expect(mealsOffNoticeDue(EIGHT + 239, EIGHT)).toBe(true);
    expect(mealsOffNoticeDue(EIGHT + 240, EIGHT)).toBe(false);
  });
  it('never buzzes in the small hours, even with a plan time then', () => {
    expect(mealsOffNoticeDue(3 * 60, 2 * 60)).toBe(false);
    expect(mealsOffNoticeDue(6 * 60, 2 * 60)).toBe(true);
  });
});

describe('why it came off', () => {
  it('names what the code knows', () => {
    expect(whyItCameOff({ missing: ['tortillas'], short: [] }, true)).toBe('no tortillas');
    expect(whyItCameOff({ missing: ['tortillas', 'salsa', 'beans'], short: [] }, true)).toBe('no tortillas or salsa');
    expect(whyItCameOff({ missing: [], short: ['eggs'] }, true)).toBe('not enough eggs');
    expect(whyItCameOff({ missing: [], short: [] }, false)).toBe('out of season');
  });
  it('says nothing it doesn’t know', () => {
    expect(whyItCameOff({ missing: [], short: [] }, true)).toBeNull();
  });
});

describe('what people read', () => {
  it('says what replaced it and why', () => {
    expect(mealOffLine(off(), 'soup')).toBe('Dinner changed to soup — no tortillas for tacos');
    expect(mealOffLine(off({ why: null }), 'soup')).toBe('Dinner changed to soup — tacos came off');
    expect(mealOffLine(off({ slot: 'lunch' }), null)).toBe('Lunch changed — no tortillas for tacos');
  });
  it('links one meal to its day', () => {
    expect(mealsOffNotice([off()], TODAY)).toEqual({ title: 'Tuesday’s tacos came off', body: 'No tortillas. Tap to put it back.', url: `/day/${TUE}` });
    expect(mealsOffNotice([off({ why: null })], TODAY).body).toBe('Tap to put it back.');
  });
  it('puts several in one notice, linked to the first', () => {
    const notice = mealsOffNotice([off(), off({ date: '2026-11-12', title: 'soup', why: 'no beans' })], TODAY);
    expect(notice.title).toBe('2 meals came off');
    expect(notice.body).toBe('Tuesday’s tacos: no tortillas. Thursday’s soup: no beans.');
    expect(notice.url).toBe(`/day/${TUE}`);
  });
});

describe('whether it still stands', () => {
  it('does with the planner’s replacement in the slot, or nothing yet', () => {
    expect(stillOff(off(), entry({}), TODAY)).toBe(true);
    expect(stillOff(off(), null, TODAY)).toBe(true);
  });
  it('doesn’t once the day has gone', () => {
    expect(stillOff(off({ date: '2026-11-08' }), null, TODAY)).toBe(false);
  });
  it('doesn’t once a person has chosen or recorded something', () => {
    expect(stillOff(off(), entry({ pinned: true }), TODAY)).toBe(false);
    expect(stillOff(off(), entry({ outcome: 'made' }), TODAY)).toBe(false);
  });
  it('doesn’t once the meal is back on', () => {
    expect(stillOff(off(), entry({ recipeSlug: 'tacos' }), TODAY)).toBe(false);
  });
});

describe('remembering', () => {
  it('keeps a slot’s latest and forgets days gone', () => {
    const gone = off({ date: '2026-11-01' });
    const before = off({ title: 'stew', recipeSlug: 'stew', told: true });
    expect(remembered([gone, before], [off()], TODAY)).toEqual([off()]);
  });
});
