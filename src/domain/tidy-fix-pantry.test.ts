import { describe, expect, it } from 'vitest';
import { pantryItem } from './test-fixtures.ts';
import { TODAY, tidyInputs } from './tidy-fixtures.ts';
import { countsOutOfStep, leftoverOnOutItems, tidiedOtherNames, untidyOtherNames } from './tidy-fix-pantry.ts';
import { expiredRecords } from './tidy-fix-records.ts';

describe('other names on an item', () => {
  it('drops repeats, blanks and the item’s own name, keeping the order', () => {
    const item = pantryItem(1, 'Jam', { alsoCalled: ['preserves', 'jam', ' ', 'Preserve', 'fruit spread'] });
    expect(tidiedOtherNames(item)).toEqual(['preserves', 'fruit spread']);
  });

  it('says nothing about a tidy item', () => {
    expect(untidyOtherNames([pantryItem(1, 'Jam', { alsoCalled: ['preserves'] })])).toEqual([]);
  });

  it('fixes an untidy one', () => {
    const [fix] = untidyOtherNames([pantryItem(1, 'Jam', { alsoCalled: ['jam'] })]);
    expect(fix.step).toEqual({ step: 'set_other_names', itemId: 1, alsoCalled: [] });
  });
});

describe('what an item that is out should not have left', () => {
  const standInsForNow = [{ itemId: 1, name: 'rice' }];

  it('finds a temporary stand-in name on an item that is out', () => {
    const fixes = leftoverOnOutItems({ pantry: [pantryItem(1, 'Basmati', { status: 'out' })], standInsForNow });
    expect(fixes.map(f => f.check)).toEqual(['stand-in-on-out-item']);
  });

  it('leaves a stand-in on an item that is in the house', () => {
    expect(leftoverOnOutItems({ pantry: [pantryItem(1, 'Basmati')], standInsForNow })).toEqual([]);
  });

  it('finds a date on an item that is out', () => {
    const fixes = leftoverOnOutItems({ pantry: [pantryItem(2, 'Milk', { status: 'out', useBy: TODAY })], standInsForNow: [] });
    expect(fixes.map(f => f.check)).toEqual(['date-on-out-item']);
  });

  it('leaves an out item with a count above zero to the count check', () => {
    expect(leftoverOnOutItems({ pantry: [pantryItem(3, 'Eggs', { status: 'out', count: 4, useBy: TODAY })], standInsForNow: [] })).toEqual([]);
  });
});

describe('a count and its status', () => {
  it('finds a status the count does not give', () => {
    const [fix] = countsOutOfStep([pantryItem(1, 'Eggs', { count: 1, status: 'have' })]);
    expect(fix.step).toEqual({ step: 'restate', itemId: 1, count: 1, status: 'low' });
  });

  it('finds a count below zero', () => {
    const [fix] = countsOutOfStep([pantryItem(1, 'Eggs', { count: -2, status: 'out' })]);
    expect(fix.step).toEqual({ step: 'restate', itemId: 1, count: 0, status: 'out' });
  });

  it('leaves agreeing counts and uncounted items alone', () => {
    expect(countsOutOfStep([pantryItem(1, 'Eggs', { count: 12 }), pantryItem(2, 'Salt', { status: 'low' })])).toEqual([]);
  });
});

describe('records kept past how long they last', () => {
  it('finds meals-off notes for days gone and old catch-up answers', () => {
    const fixes = expiredRecords(tidyInputs({ mealsOffDates: ['2026-11-10', '2026-11-13'], catchUpNoDays: ['2026-10-01', '2026-11-11'] }));
    expect(fixes.map(f => f.step.step)).toEqual(['forget_old_meals_off', 'forget_old_catch_up']);
  });

  it('finds old answers to Any left? and fridge lines past their days', () => {
    const fixes = expiredRecords(tidyInputs({ dinnerAnswerDays: ['2026-10-01', '2026-11-10'], fridgeSince: ['2026-11-07', '2026-11-08'] }));
    expect(fixes.map(f => f.step.step)).toEqual(['forget_old_answers', 'forget_old_fridge']);
  });

  it('finds nothing in records that are still in date', () => {
    expect(expiredRecords(tidyInputs({ mealsOffDates: ['2026-11-12'], catchUpNoDays: ['2026-11-11'], dinnerAnswerDays: ['2026-11-01'], fridgeSince: ['2026-11-09'] }))).toEqual([]);
  });
});
