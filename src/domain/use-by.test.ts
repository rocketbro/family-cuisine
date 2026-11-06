import { describe, expect, it } from 'vitest';
import { pantryItem } from './test-fixtures.ts';
import { dateAfterChange, dateWording, goingOffSoon } from './use-by.ts';

describe('use by dates', () => {
  const today = '2026-11-04'; // a Wednesday
  const dated = { status: 'have' as const, useBy: null, useByEstimated: false, lastsDays: null };

  it('keeps a date that was said, and clears it when the item runs out', () => {
    expect(dateAfterChange(dated, { useBy: '2026-11-12' }, today)).toEqual({ useBy: '2026-11-12', useByEstimated: false });
    expect(dateAfterChange({ ...dated, useBy: '2026-11-12' }, { status: 'out' }, today)).toEqual({ useBy: null, useByEstimated: false });
  });
  it('sets an estimate from how long it lasts when it comes back', () => {
    const gone = { ...dated, status: 'out' as const, lastsDays: 5 };
    expect(dateAfterChange(gone, { status: 'have' }, today)).toEqual({ useBy: '2026-11-09', useByEstimated: true });
  });
  it('leaves a printed date alone when the status or shelf life changes', () => {
    const printed = { ...dated, useBy: '2026-11-20', lastsDays: 5 };
    expect(dateAfterChange(printed, { status: 'low' }, today).useBy).toBe('2026-11-20');
    expect(dateAfterChange(printed, { lastsDays: 3 }, today).useBy).toBe('2026-11-20');
  });
  it('recounts an estimate when the shelf life is corrected', () => {
    const guess = { ...dated, useBy: '2026-11-09', useByEstimated: true, lastsDays: 5 };
    expect(dateAfterChange(guess, { lastsDays: 3 }, today).useBy).toBe('2026-11-07');
    expect(dateAfterChange(guess, { lastsDays: null }, today).useBy).toBeNull();
  });
  it('lists what is close or past, soonest first, skipping what is gone', () => {
    const items = [
      pantryItem(1, 'milk', { useBy: '2026-11-07' }),
      pantryItem(2, 'yogurt', { useBy: '2026-11-03' }),
      pantryItem(3, 'cheese', { useBy: '2026-12-01' }),
      pantryItem(4, 'spinach', { useBy: '2026-11-05', status: 'out' }),
      pantryItem(5, 'rice'),
    ];
    expect(goingOffSoon(items, today).map(i => i.name)).toEqual(['yogurt', 'milk']);
  });
  it('words the date plainly and marks estimates', () => {
    expect(dateWording({ useBy: '2026-11-03', useByEstimated: false }, today)).toBe('past its date');
    expect(dateWording({ useBy: '2026-11-04', useByEstimated: false }, today)).toBe('use today');
    expect(dateWording({ useBy: '2026-11-05', useByEstimated: true }, today)).toBe('use by about tomorrow');
    expect(dateWording({ useBy: '2026-11-07', useByEstimated: false }, today)).toBe('use by Saturday');
    expect(dateWording({ useBy: '2026-11-19', useByEstimated: true }, today)).toBe('use by about Nov 19');
    expect(dateWording({ useBy: null, useByEstimated: false }, today)).toBeNull();
  });
});
