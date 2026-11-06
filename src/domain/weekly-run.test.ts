import { describe, expect, it } from 'vitest';
import { weeklyNoticeFits, weeklyRunDay } from './weekly-run.ts';

describe('when the weekly plan is due', () => {
  const SUNDAY = '2026-11-08';
  const day = (offset: number) => `2026-11-${String(8 + offset).padStart(2, '0')}`;
  const EIGHT = 8 * 60;
  const EVENING = 19 * 60 + 45;

  it('waits for its time on the day', () => {
    expect(weeklyRunDay(SUNDAY, EIGHT - 1, 0, EIGHT)).toBeNull();
    expect(weeklyRunDay(SUNDAY, EIGHT, 0, EIGHT)).toBe(SUNDAY);
  });
  it('is still due later in the week, under the day it belonged to', () => {
    for (const late of [1, 2, 3, 4, 5]) expect(weeklyRunDay(day(late), 0, 0, EIGHT)).toBe(SUNDAY);
  });
  it('leaves it to the next run the day before', () => {
    expect(weeklyRunDay(day(6), 12 * 60, 0, EIGHT)).toBeNull();
  });
  it('announces it on the day at any time, a day late only in the daytime, and after that not at all', () => {
    expect(weeklyNoticeFits(SUNDAY, SUNDAY, 23 * 60, EIGHT, EVENING)).toBe(true);
    expect(weeklyNoticeFits(SUNDAY, day(1), 12 * 60, EIGHT, EVENING)).toBe(true);
    expect(weeklyNoticeFits(SUNDAY, day(1), 2 * 60, EIGHT, EVENING)).toBe(false);
    expect(weeklyNoticeFits(SUNDAY, day(1), 21 * 60, EIGHT, EVENING)).toBe(false);
    expect(weeklyNoticeFits(SUNDAY, day(2), 12 * 60, EIGHT, EVENING)).toBe(false);
  });
});
