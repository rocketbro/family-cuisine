import { describe, expect, it } from 'vitest';
import { datesInWrittenOrder, reviewDays } from './plan-import-days.ts';

const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6;
const SATURDAY = '2026-11-07';
const SATURDAY_RANGE = { from: SATURDAY, through: '2026-11-16' };
const named = (...weekdays: number[]) => weekdays.map(weekday => ({ date: null, weekday }));

describe('days in written order', () => {
  it('spans two weekends when Saturday and Sunday come round again', () => {
    expect(datesInWrittenOrder(named(SAT, SUN, MON, TUE, WED, THU, FRI, SAT, SUN), SATURDAY_RANGE)).toEqual([
      '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
    ]);
  });

  it('keeps several meals on one day', () => {
    expect(datesInWrittenOrder(named(SAT, SAT, SAT, SUN, SUN), SATURDAY_RANGE)).toEqual(['2026-11-07', '2026-11-07', '2026-11-07', '2026-11-08', '2026-11-08']);
  });

  it('starts on the first of that day on or after the from date', () => {
    expect(datesInWrittenOrder(named(MON), SATURDAY_RANGE)).toEqual(['2026-11-09']);
    expect(datesInWrittenOrder(named(FRI, MON), SATURDAY_RANGE)).toEqual(['2026-11-13', '2026-11-16']);
  });

  it('reads a list that starts just before the range as starting there, not a week on', () => {
    const napkin = named(FRI, SAT, SUN, MON, TUE, WED, THU, FRI, SAT, SUN);
    expect(datesInWrittenOrder(napkin, SATURDAY_RANGE)).toEqual([
      '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
    ]);
  });

  it('lets a written date win and move the walk, even backward', () => {
    expect(datesInWrittenOrder([
      { date: null, weekday: SAT },
      { date: '2026-11-20', weekday: null },
      { date: null, weekday: SAT },
      { date: '2026-11-10', weekday: MON },
      { date: null, weekday: WED },
    ], SATURDAY_RANGE)).toEqual(['2026-11-07', '2026-11-20', '2026-11-21', '2026-11-10', '2026-11-11']);
  });

  it('leaves a meal with no day without one, and doesn’t move the walk for it', () => {
    expect(datesInWrittenOrder([
      { date: null, weekday: null },
      { date: null, weekday: SUN },
      { date: null, weekday: null },
      { date: null, weekday: SUN },
    ], SATURDAY_RANGE)).toEqual([null, '2026-11-08', null, '2026-11-08']);
  });

  it('crosses a month and a year', () => {
    expect(datesInWrittenOrder(named(THU, FRI, THU), { from: '2026-12-31', through: '2027-01-09' })).toEqual(['2026-12-31', '2027-01-01', '2027-01-07']);
  });
});

describe('the pages of a review', () => {
  const range = { from: SATURDAY, through: '2026-11-10' };

  it('is every day in the range, then any meal’s date beyond it', () => {
    expect(reviewDays(range, ['2026-11-08', '2026-11-14'], '2026-11-06')).toEqual(['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-14']);
  });

  it('drops days gone by, unless a meal landed on one', () => {
    expect(reviewDays(range, ['2026-11-07'], '2026-11-09')).toEqual(['2026-11-07', '2026-11-09', '2026-11-10']);
    expect(reviewDays(range, [], '2026-11-09')).toEqual(['2026-11-09', '2026-11-10']);
  });
});
