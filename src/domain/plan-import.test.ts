import { describe, expect, it } from 'vitest';
import { assumedWeekStart, clashingSlots, dateInWeek, importedDate, placementsToSave, type ImportedMeal } from './plan-import.ts';

// A Friday.
const FRIDAY = '2026-11-06';
const SUNDAY = 0, MONDAY = 1, TUESDAY = 2, THURSDAY = 4, FRI = 5, SATURDAY = 6;

const meal = (over: Partial<ImportedMeal>): ImportedMeal => ({
  said: 'tacos', date: null, weekday: null, slot: 'dinner', match: { kind: 'named', name: 'Tacos' }, confidence: 'sure', ...over,
});

describe('which week a plan means', () => {
  it('starts a Monday-to-Friday plan written on a Friday next Monday, not today', () => {
    expect(assumedWeekStart([meal({ weekday: MONDAY }), meal({ weekday: FRI })], FRIDAY)).toBe('2026-11-09');
  });

  it('starts today when the plan’s first day is today', () => {
    expect(assumedWeekStart([meal({ weekday: FRI }), meal({ weekday: MONDAY })], FRIDAY)).toBe(FRIDAY);
  });

  it('starts tomorrow for a Sunday-to-Saturday plan written on a Saturday', () => {
    expect(assumedWeekStart([meal({ weekday: SUNDAY }), meal({ weekday: SATURDAY })], '2026-11-07')).toBe('2026-11-08');
  });

  it('goes by the first day it names, not the earliest in the week', () => {
    expect(assumedWeekStart([meal({ weekday: THURSDAY }), meal({ weekday: TUESDAY })], FRIDAY)).toBe('2026-11-12');
  });

  it('goes by a written date over a named day', () => {
    expect(assumedWeekStart([meal({ weekday: MONDAY }), meal({ date: '2026-11-20' })], FRIDAY)).toBe('2026-11-20');
  });

  it('doesn’t anchor on a written date that’s gone by', () => {
    expect(assumedWeekStart([meal({ date: '2026-11-01' }), meal({ weekday: TUESDAY })], FRIDAY)).toBe('2026-11-10');
  });

  it('starts today when the plan names no days at all', () => {
    expect(assumedWeekStart([meal({})], FRIDAY)).toBe(FRIDAY);
  });

  it('crosses a month and a year', () => {
    expect(assumedWeekStart([meal({ weekday: FRI })], '2026-12-31')).toBe('2027-01-01');
  });
});

describe('where a line lands', () => {
  it('puts a weekday in the seven days from the start, wrapping past the end of the calendar week', () => {
    const start = '2026-11-11'; // the Wednesday of a Wednesday-to-Tuesday trip week
    expect(dateInWeek(2, start)).toBe('2026-11-17');
    expect(dateInWeek(3, start)).toBe(start);
    expect(dateInWeek(0, start)).toBe('2026-11-15');
  });

  it('moves with the week, unless it has its own date', () => {
    expect(importedDate(meal({ weekday: MONDAY }), '2026-11-08')).toBe('2026-11-09');
    expect(importedDate(meal({ weekday: MONDAY }), '2026-11-15')).toBe('2026-11-16');
    expect(importedDate(meal({ weekday: MONDAY, date: '2026-12-01' }), '2026-11-15')).toBe('2026-12-01');
    expect(importedDate(meal({}), '2026-11-15')).toBeNull();
  });
});

describe('what a review saves', () => {
  it('leaves out lines with no day and days that have passed', () => {
    const saved = placementsToSave([meal({ weekday: MONDAY }), meal({}), meal({ date: '2026-11-01' }), meal({ date: FRIDAY, slot: 'lunch' })], '2026-11-08', FRIDAY);
    expect(saved.map(p => p.date)).toEqual(['2026-11-09', FRIDAY]);
  });

  it('finds two lines for one meal, but lets extras pile up', () => {
    const clashes = clashingSlots([
      { date: FRIDAY, slot: 'dinner' }, { date: FRIDAY, slot: 'dinner' }, { date: FRIDAY, slot: 'lunch' },
      { date: FRIDAY, slot: 'extra' }, { date: FRIDAY, slot: 'extra' },
    ]);
    expect([...clashes]).toEqual([`${FRIDAY}:dinner`]);
  });
});
