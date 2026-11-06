import { describe, expect, it } from 'vitest';
import { beforeGroceries, nextTrip, planHorizonEnd, regularFor, tripIfUnmoved, tripMoveChoices, tripsBetween, type ShopSchedule } from './shop-schedule.ts';

describe('moving one week\'s trip', () => {
  const moved: ShopSchedule = { weekday: 3, moved: { '2026-11-04': '2026-11-06' } };
  it('uses the moved day for that week only', () => {
    expect(nextTrip('2026-11-03', moved)).toBe('2026-11-06');
    expect(nextTrip('2026-11-05', moved)).toBe('2026-11-06'); // the regular Wednesday has passed, Friday hasn't
    expect(nextTrip('2026-11-07', moved)).toBe('2026-11-11');
    expect(regularFor('2026-11-06', moved)).toBe('2026-11-04');
  });
  it('keeps meals ready-only until the moved trip, and covers through the next one', () => {
    expect(beforeGroceries('2026-11-05', '2026-11-03', moved)).toBe(true);
    expect(beforeGroceries('2026-11-06', '2026-11-03', moved)).toBe(false);
    expect(planHorizonEnd('2026-11-03', moved)).toBe('2026-11-10');
  });
  it('moving earlier works too', () => {
    const early: ShopSchedule = { weekday: 3, moved: { '2026-11-11': '2026-11-09' } };
    expect(nextTrip('2026-11-05', early)).toBe('2026-11-09');
    expect(tripsBetween('2026-11-01', '2026-11-14', early)).toEqual(['2026-11-04', '2026-11-09']);
  });
});

describe('choosing a day for the coming trip', () => {
  const WEDNESDAY = 3;
  const FRIDAY = '2026-11-06';

  it('runs from today to the day before the usual trip after it', () => {
    const days = tripMoveChoices('2026-11-02', { weekday: WEDNESDAY, moved: {} });
    expect(days[0]).toBe('2026-11-02');
    expect(days.at(-1)).toBe('2026-11-10');
  });
  it('counts from the usual day of a trip that already moved', () => {
    const days = tripMoveChoices(FRIDAY, { weekday: WEDNESDAY, moved: { '2026-11-04': FRIDAY } });
    expect(days).toEqual([FRIDAY, '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10']);
  });
  it('still offers the day a trip is on, when it was moved past the usual trip after it', () => {
    const days = tripMoveChoices('2026-11-12', { weekday: WEDNESDAY, moved: { '2026-11-04': '2026-11-13', '2026-11-11': '2026-11-20' } });
    expect(days).toContain(nextTrip('2026-11-12', { weekday: WEDNESDAY, moved: { '2026-11-04': '2026-11-13', '2026-11-11': '2026-11-20' } }));
  });
});

describe('undoing a move', () => {
  const WEDNESDAY = 3;

  it('goes back to the usual day while that is still ahead', () => {
    expect(tripIfUnmoved('2026-11-02', { weekday: WEDNESDAY, moved: { '2026-11-04': '2026-11-06' } })).toBe('2026-11-04');
  });
  it('lands on the next usual day once that has passed', () => {
    expect(tripIfUnmoved('2026-11-05', { weekday: WEDNESDAY, moved: { '2026-11-04': '2026-11-06' } })).toBe('2026-11-11');
  });
});
