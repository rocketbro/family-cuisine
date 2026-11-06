import { describe, expect, it } from 'vitest';
import { moveTarget, movePreview, portionsAfterMove, stockAsPortions, totalText, type MoveResult } from './portion-move.ts';
import { soonestDate, type Portion } from './portions.ts';
import { pantryItem } from './test-fixtures.ts';
import { dateWording, goingOffSoon } from './use-by.ts';

describe('moving stock between fresh and frozen', () => {
  const today = '2026-11-06';
  const portion = (storage: Portion['storage'], amount: number | null, unit: Portion['unit'] = 'lb', useBy: string | null = null): Portion => ({ storage, amount, unit, canOz: null, useBy, useByEstimated: false });
  const moved = (result: MoveResult) => {
    if ('problem' in result) throw new Error(result.problem);
    return result.portions;
  };
  const brief = (portions: Portion[]) => portions.map(p => [p.storage, p.amount, p.useBy]);

  it('only swaps fresh and frozen', () => {
    expect(moveTarget('fresh')).toBe('frozen');
    expect(moveTarget('frozen')).toBe('fresh');
    expect(moveTarget('canned')).toBeNull();
    expect(moveTarget('dried')).toBeNull();
    expect(portionsAfterMove([portion('canned', 2, 'can')], { from: 'canned', to: 'fresh', amount: null }, null, today)).toHaveProperty('problem');
  });
  it('freezing all of it keeps the total and takes the date off', () => {
    const result = moved(portionsAfterMove([portion('fresh', 1, 'lb', '2026-11-05')], { from: 'fresh', to: 'frozen', amount: null }, null, today));
    expect(brief(result)).toEqual([['frozen', 1, null]]);
    expect(totalText(result)).toBe('1 lb');
  });
  it('a past-date item doesn’t read as past its date once frozen', () => {
    const sausage = [portion('fresh', 1, 'lb', '2026-11-05')];
    const dates = soonestDate(moved(portionsAfterMove(sausage, { from: 'fresh', to: 'frozen', amount: null }, null, today)));
    expect(dates.useBy).toBeNull();
    expect(dateWording(dates, today)).toBeNull();
    expect(goingOffSoon([pantryItem(1, 'sausage', dates)], today)).toEqual([]);
  });
  it('freezing part of it leaves the rest and its date behind', () => {
    const result = moved(portionsAfterMove([portion('fresh', 3, 'lb', '2026-11-08')], { from: 'fresh', to: 'frozen', amount: 1 }, null, today));
    expect(brief(result)).toEqual([['fresh', 2, '2026-11-08'], ['frozen', 1, null]]);
    expect(totalText(result)).toBe('3 lb');
  });
  it('adds to what’s already frozen, which keeps its own date', () => {
    const result = moved(portionsAfterMove([portion('fresh', 1, 'lb', '2026-11-05'), portion('frozen', 5, 'lb', '2027-02-01')], { from: 'fresh', to: 'frozen', amount: null }, null, today));
    expect(brief(result)).toEqual([['frozen', 6, '2027-02-01']]);
  });
  it('converts to how the frozen is measured', () => {
    const result = moved(portionsAfterMove([portion('fresh', 1, 'lb'), portion('frozen', 8, 'oz')], { from: 'fresh', to: 'frozen', amount: null }, null, today));
    expect(result[0]).toMatchObject({ storage: 'frozen', unit: 'oz' });
    expect(result[0].amount).toBeCloseTo(24);
  });
  it('refuses what it can’t add up, rather than change the total', () => {
    const packages = [portion('fresh', 1, 'lb'), portion('frozen', 2, 'package')];
    expect(portionsAfterMove(packages, { from: 'fresh', to: 'frozen', amount: null }, null, today)).toHaveProperty('problem');
  });
  it('refuses more than there is, or nothing', () => {
    const one = [portion('fresh', 1)];
    expect(portionsAfterMove(one, { from: 'fresh', to: 'frozen', amount: 2 }, null, today)).toEqual({ problem: 'There’s only 1 lb fresh.' });
    expect(portionsAfterMove(one, { from: 'fresh', to: 'frozen', amount: 0 }, null, today)).toHaveProperty('problem');
    expect(portionsAfterMove(one, { from: 'frozen', to: 'fresh', amount: null }, null, today)).toHaveProperty('problem');
  });
  it('some stays some', () => {
    expect(brief(moved(portionsAfterMove([portion('fresh', null, null)], { from: 'fresh', to: 'frozen', amount: 1 }, null, today)))).toEqual([['frozen', null, null]]);
    expect(moved(portionsAfterMove([portion('fresh', 1), portion('frozen', null)], { from: 'fresh', to: 'frozen', amount: null }, null, today))[0].amount).toBeNull();
  });
  describe('thawing', () => {
    it('starts the clock from how long the item lasts', () => {
      const [fresh] = moved(portionsAfterMove([portion('frozen', 2)], { from: 'frozen', to: 'fresh', amount: null }, 3, today));
      expect(fresh).toMatchObject({ storage: 'fresh', amount: 2, useBy: '2026-11-09', useByEstimated: true });
    });
    it('sets no date when nobody knows how long it lasts', () => {
      expect(moved(portionsAfterMove([portion('frozen', 2)], { from: 'frozen', to: 'fresh', amount: null }, null, today))[0].useBy).toBeNull();
    });
    it('keeps a sooner date already on the fresh', () => {
      const result = moved(portionsAfterMove([portion('fresh', 1, 'lb', '2026-11-07'), portion('frozen', 2)], { from: 'frozen', to: 'fresh', amount: 1 }, 5, today));
      expect(brief(result)).toEqual([['fresh', 2, '2026-11-07'], ['frozen', 1, null]]);
    });
    it('freezing and thawing again comes back to the same amount', () => {
      const frozen = moved(portionsAfterMove([portion('fresh', 1.5)], { from: 'fresh', to: 'frozen', amount: null }, null, today));
      expect(totalText(moved(portionsAfterMove(frozen, { from: 'frozen', to: 'fresh', amount: null }, null, today)))).toBe('1½ lb');
    });
  });
  describe('items with no portions yet', () => {
    it('reads a count as that many fresh, with the item’s date', () => {
      const stock = stockAsPortions(pantryItem(1, 'chicken breasts', { count: 3, useBy: '2026-11-08' }));
      expect(brief(stock)).toEqual([['fresh', 3, '2026-11-08']]);
      expect(brief(moved(portionsAfterMove(stock, { from: 'fresh', to: 'frozen', amount: 2 }, null, today)))).toEqual([['fresh', 1, '2026-11-08'], ['frozen', 2, null]]);
    });
    it('reads a plain item as some fresh', () => {
      expect(brief(stockAsPortions(pantryItem(1, 'milk')))).toEqual([['fresh', null, null]]);
    });
    it('has nothing to move when it’s out', () => {
      expect(stockAsPortions(pantryItem(1, 'milk', { status: 'out' }))).toEqual([]);
      expect(stockAsPortions(pantryItem(1, 'eggs', { status: 'out', count: 0 }))).toEqual([]);
    });
  });
  describe('saying what will happen', () => {
    it('states the result, the total and the date', () => {
      expect(movePreview([portion('fresh', 1, 'lb', '2026-11-05')], { from: 'fresh', to: 'frozen', amount: null }, null, today)).toEqual({
        before: '1 lb fresh', after: '1 lb frozen', total: 'Still 1 lb in all.', date: 'Its use-by date comes off.',
      });
    });
    it('says what stays behind on a part move', () => {
      expect(movePreview([portion('fresh', 3, 'lb', '2026-11-08')], { from: 'fresh', to: 'frozen', amount: 1 }, null, today)).toMatchObject({
        after: '2 lb fresh · 1 lb frozen', total: 'Still 3 lb in all.', date: 'The fresh keeps its use-by date.',
      });
    });
    it('says what a thaw does to the date', () => {
      expect(movePreview([portion('frozen', 2)], { from: 'frozen', to: 'fresh', amount: null }, 3, today)).toMatchObject({ date: 'Use by about Nov 9.' });
      expect(movePreview([portion('frozen', 2)], { from: 'frozen', to: 'fresh', amount: null }, null, today)).toMatchObject({ date: 'No use-by date until you set one.' });
    });
    it('doesn’t claim a total it can’t add up', () => {
      expect(movePreview([portion('fresh', null, null)], { from: 'fresh', to: 'frozen', amount: null }, null, today)).toMatchObject({ total: 'Nothing added, only moved.', after: 'some frozen' });
    });
  });
});
