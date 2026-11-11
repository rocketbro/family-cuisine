import { describe, expect, it } from 'vitest';
import { clashingSlots, defaultImportRange, placementsToSave, withFrom, withThrough, type ImportedMeal } from './plan-import.ts';

// A Friday.
const FRIDAY = '2026-11-06';

const meal = (over: Partial<ImportedMeal>): ImportedMeal => ({
  said: 'tacos', date: null, slot: 'dinner', match: { kind: 'named', name: 'Tacos' }, confidence: 'sure', ...over,
});

describe('the days being planned', () => {
  it('defaults to the next trip through the day before the one after', () => {
    expect(defaultImportRange(FRIDAY, { trips: ['2026-11-07'] })).toEqual({ from: '2026-11-07', through: '2026-11-13' });
  });

  it('counts a chosen trip', () => {
    expect(defaultImportRange(FRIDAY, { trips: ['2026-11-07', '2026-11-16'] })).toEqual({ from: '2026-11-07', through: '2026-11-15' });
  });

  it('keeps its length when the start moves past the end, and never ends before it starts', () => {
    const range = { from: '2026-11-07', through: '2026-11-13' };
    expect(withFrom(range, '2026-11-09')).toEqual({ from: '2026-11-09', through: '2026-11-13' });
    expect(withFrom(range, '2026-11-20')).toEqual({ from: '2026-11-20', through: '2026-11-26' });
    expect(withThrough(range, '2026-11-20')).toEqual({ from: '2026-11-07', through: '2026-11-20' });
    expect(withThrough(range, '2026-11-01')).toEqual({ from: '2026-11-07', through: '2026-11-07' });
  });
});

describe('what a review saves', () => {
  it('leaves out lines with no day and days that have passed', () => {
    const saved = placementsToSave([meal({ date: '2026-11-09' }), meal({}), meal({ date: '2026-11-01' }), meal({ date: FRIDAY, slot: 'lunch' })], FRIDAY);
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
