import { describe, expect, it } from 'vitest';
import { mealMove, moveRefusal } from './meal-move.ts';
import { moveOptions, putBackOptions } from './meal-move-options.ts';
import { blankEntry, type PlanEntry } from './plan.ts';

const TODAY = '2026-11-04';
const THU = '2026-11-05';
const FRI = '2026-11-06';
const SAT = '2026-11-07';
const MON = '2026-11-09';

const dinner = (date: string, slug: string, over: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(date, 'dinner'), kind: 'recipe', recipeSlug: slug, ...over });
const leftovers = (date: string, slot: 'lunch' | 'dinner', of: string, over: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(date, slot), kind: 'leftovers', leftoversOf: { date: of, slot: 'dinner' }, ...over });
const from = (date: string) => ({ date, slot: 'dinner' as const });

describe('what a move refuses', () => {
  const tacos = dinner(TODAY, 'tacos');

  it('needs a meal that is still only planned', () => {
    expect(moveRefusal([], from(TODAY), THU, TODAY)).toBe('nothing-there');
    expect(moveRefusal([blankEntry(TODAY, 'dinner')], from(TODAY), THU, TODAY)).toBe('nothing-there');
    for (const over of [{ outcome: 'made' }, { outcome: 'skipped' }, { outcome: 'swapped' }, { pantrySettled: true }, { checkinSettled: true }] as Partial<PlanEntry>[]) {
      expect(moveRefusal([dinner(TODAY, 'tacos', over)], from(TODAY), THU, TODAY)).toBe('already-happened');
    }
  });

  it('won’t go to its own day or a past one', () => {
    expect(moveRefusal([tacos], from(TODAY), TODAY, TODAY)).toBe('same-day');
    expect(moveRefusal([tacos], from(TODAY), '2026-11-03', TODAY)).toBe('past-day');
    expect(moveRefusal([tacos], from(TODAY), THU, TODAY)).toBeNull();
  });

  it('won’t trade with a meal that has an outcome', () => {
    expect(moveRefusal([tacos, dinner(THU, 'soup', { outcome: 'made' })], from(TODAY), THU, TODAY)).toBe('other-happened');
    expect(moveRefusal([tacos, dinner(THU, 'soup', { outcome: 'skipped' })], from(TODAY), THU, TODAY)).toBe('other-happened');
  });

  it('lets a meal off a past day only onto an open one, since a trade would put the other on that past day', () => {
    const missed = dinner('2026-11-03', 'tacos');
    expect(moveRefusal([missed], from('2026-11-03'), TODAY, TODAY)).toBeNull();
    expect(moveRefusal([missed, dinner(TODAY, 'soup')], from('2026-11-03'), TODAY, TODAY)).toBe('trade-into-past');
  });
});

describe('moving a meal', () => {
  it('carries everything that belongs to it, and pins both', () => {
    const drafted = { how: 'Add rice', uses: [] };
    const tacos = dinner(TODAY, 'tacos', { multiplier: 2, drafted, substituted: { 0: 'x' } });
    const soup = dinner(THU, 'soup');
    const { placed, traded } = mealMove([tacos, soup], from(TODAY), THU);
    expect(traded).toBe(soup);
    expect(placed).toEqual(expect.arrayContaining([
      { ...tacos, date: THU, pinned: true },
      { ...soup, date: TODAY, pinned: true },
    ]));
  });

  it('moves a name-only meal and leftovers too', () => {
    const named = { ...blankEntry(TODAY, 'dinner'), note: 'Burgers' };
    expect(mealMove([named], from(TODAY), THU).placed).toEqual([{ ...named, date: THU, pinned: true }]);
  });

  it('points leftovers at the dinner’s new day when they still come after it', () => {
    const tacos = dinner(THU, 'tacos');
    const soup = dinner(TODAY, 'soup');
    const lunch = leftovers(FRI, 'lunch', THU);
    const { placed, off } = mealMove([soup, tacos, lunch], from(THU), TODAY);
    expect(off).toEqual([]);
    expect(placed).toContainEqual({ ...lunch, leftoversOf: { date: TODAY, slot: 'dinner' } });
  });

  it('takes planned leftovers off when they’d come before the dinner, even later the same day', () => {
    const tacos = dinner(TODAY, 'tacos');
    const lunch = leftovers(THU, 'lunch', TODAY);
    const { placed, off } = mealMove([tacos, lunch], from(TODAY), THU);
    expect(off).toEqual([lunch]);
    expect(placed).toEqual([{ ...tacos, date: THU, pinned: true }]);
  });

  it('keeps chosen leftovers as plain ones when they no longer fit', () => {
    const tacos = dinner(TODAY, 'tacos');
    const lunch = leftovers(THU, 'lunch', TODAY, { pinned: true });
    const { placed, off } = mealMove([tacos, lunch], from(TODAY), FRI);
    expect(off).toEqual([]);
    expect(placed).toContainEqual({ ...lunch, leftoversOf: null });
  });

  it('never leaves leftovers pointing at what traded into the dinner’s place', () => {
    const tacos = dinner(TODAY, 'tacos');
    const soup = dinner(THU, 'soup');
    const tacoLunch = leftovers(THU, 'lunch', TODAY);
    const soupLunch = leftovers(FRI, 'lunch', THU);
    const { placed, off } = mealMove([tacos, soup, tacoLunch, soupLunch], from(TODAY), THU);
    expect(off).toEqual([tacoLunch]); // Thursday's lunch comes before Thursday's tacos
    expect(placed).toContainEqual({ ...soupLunch, leftoversOf: { date: TODAY, slot: 'dinner' } });
  });

  it('takes off leftovers that would no longer keep', () => {
    const tacos = dinner(MON, 'tacos');
    const soup = dinner(FRI, 'soup');
    const later = leftovers('2026-11-10', 'lunch', MON);
    expect(mealMove([soup, tacos, later], from(MON), FRI).off).toEqual([later]);
  });

  it('keeps leftovers already eaten, losing the source rather than coming off', () => {
    const tacos = dinner(TODAY, 'tacos');
    const eaten = leftovers(THU, 'lunch', TODAY, { outcome: 'made' });
    const { placed, off } = mealMove([tacos, eaten], from(TODAY), FRI);
    expect(off).toEqual([]);
    expect(placed).toContainEqual({ ...eaten, leftoversOf: null });
  });

  it('takes planned leftovers off when a dinner trades with its own leftovers', () => {
    const tacos = dinner(TODAY, 'tacos');
    const own = leftovers(THU, 'dinner', TODAY);
    const { placed, off, traded } = mealMove([tacos, own], from(TODAY), THU);
    expect(off).toEqual([own]);
    expect(traded).toBeNull();
    expect(placed).toEqual([{ ...tacos, date: THU, pinned: true }]);
  });

  it('keeps chosen leftovers traded with their own dinner, as plain ones', () => {
    const tacos = dinner(TODAY, 'tacos');
    const own = leftovers(THU, 'dinner', TODAY, { pinned: true });
    const { placed, traded } = mealMove([tacos, own], from(TODAY), THU);
    expect(traded).toBe(own);
    expect(placed).toContainEqual({ ...own, date: TODAY, leftoversOf: null });
  });

  it('keeps moved leftovers on when they go before their dinner, since someone just put them there', () => {
    const tacos = dinner(TODAY, 'tacos');
    const own = leftovers(THU, 'dinner', TODAY);
    const { placed, off } = mealMove([tacos, own], from(THU), SAT);
    expect(off).toEqual([]);
    expect(placed).toEqual([{ ...own, date: SAT, pinned: true, leftoversOf: { date: TODAY, slot: 'dinner' } }]);
    const tooEarly = mealMove([tacos, own], from(THU), TODAY).placed.find(e => e.kind === 'leftovers');
    expect(tooEarly).toMatchObject({ date: TODAY, pinned: true, leftoversOf: null });
  });
});

describe('what a day’s row says', () => {
  it('names what it trades with, what stops it, and leftovers that come off', () => {
    const tacos = dinner(TODAY, 'tacos');
    const soup = dinner(THU, 'soup');
    const made = dinner(FRI, 'stew', { outcome: 'made' });
    const lunch = leftovers(THU, 'lunch', TODAY);
    const options = moveOptions([tacos, soup, made, lunch], from(TODAY), [THU, FRI, SAT], TODAY);
    expect(options[0]).toMatchObject({ refused: null, other: soup, leftoversOff: [lunch] });
    expect(options[1]).toMatchObject({ refused: 'other-happened', other: made });
    expect(options[2]).toMatchObject({ refused: null, other: null, leftoversOff: [lunch] });
  });

  it('for a meal that came off, only a recorded meal stops a day', () => {
    const options = putBackOptions([dinner(THU, 'soup'), dinner(FRI, 'stew', { outcome: 'made' })], 'dinner', [THU, FRI, SAT]);
    expect(options.map(o => o.refused)).toEqual([null, 'other-happened', null]);
  });
});
