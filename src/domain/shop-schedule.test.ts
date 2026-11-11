import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { beforeGroceries, nextTrip, nextTripWindow, planHorizonEnd, previousTripWindow, tripsBetween, tripWindow, withTripMoved, type ShopSchedule } from './shop-schedule.ts';

const WEDNESDAYS: ShopSchedule = { trips: ['2026-11-04'] };

describe('trips going forward', () => {
  it('uses a chosen day, then counts weeks on from it', () => {
    const chosen: ShopSchedule = { trips: ['2026-11-04', '2026-11-07'] };
    expect(nextTrip('2026-11-05', chosen)).toBe('2026-11-07');
    expect(nextTrip('2026-11-07', chosen)).toBe('2026-11-07');
    expect(nextTrip('2026-11-08', chosen)).toBe('2026-11-14');
    expect(nextTrip('2026-11-15', chosen)).toBe('2026-11-21');
  });

  it('counts weeks back from the first one on record', () => {
    expect(nextTrip('2026-10-20', WEDNESDAYS)).toBe('2026-10-21');
    expect(tripWindow('2026-10-20', WEDNESDAYS)).toEqual({ start: '2026-10-14', end: '2026-10-20' });
  });

  it('keeps meals ready-only until the trip, and covers through the next one', () => {
    const chosen: ShopSchedule = { trips: ['2026-11-06'] };
    expect(beforeGroceries('2026-11-05', '2026-11-03', chosen)).toBe(true);
    expect(beforeGroceries('2026-11-06', '2026-11-03', chosen)).toBe(false);
    expect(planHorizonEnd('2026-11-03', chosen)).toBe('2026-11-12');
  });
});

describe('putting a trip on a different day', () => {
  it('stretches the days before it, and counts on from the new day', () => {
    const moved = { trips: withTripMoved(['2026-11-07'], '2026-11-14', '2026-11-17') };
    expect(tripWindow('2026-11-10', moved)).toEqual({ start: '2026-11-07', end: '2026-11-16' });
    expect(nextTrip('2026-11-18', moved)).toBe('2026-11-24');
  });

  it('lets a trip that didn’t happen go, so the last one carries on until the new day', () => {
    const moved = { trips: withTripMoved(['2026-11-04', '2026-11-07'], '2026-11-07', '2026-11-09') };
    expect(moved.trips).toEqual(['2026-11-04', '2026-11-09']);
    expect(tripWindow('2026-11-08', moved)).toEqual({ start: '2026-11-04', end: '2026-11-08' });
  });

  it('keeps the weekly trips that had already gone by on record', () => {
    expect(withTripMoved(['2026-11-04'], '2026-11-25', '2026-11-27')).toEqual(['2026-11-04', '2026-11-11', '2026-11-18', '2026-11-27']);
  });

  it('drops a later trip that was already chosen', () => {
    expect(withTripMoved(['2026-11-04', '2026-11-11', '2026-11-20'], '2026-11-11', '2026-11-13')).toEqual(['2026-11-04', '2026-11-13']);
  });

  it('starts from nothing the first time', () => {
    expect(withTripMoved([], '2026-11-11', '2026-11-13')).toEqual(['2026-11-13']);
  });
});

describe('the days between trips', () => {
  it('runs from the trip through the day before the next one', () => {
    expect(tripWindow('2026-11-08', WEDNESDAYS)).toEqual({ start: '2026-11-04', end: '2026-11-10' });
  });

  it('gives the trip day to the window it starts, and the day before to the one it ends', () => {
    expect(tripWindow('2026-11-11', WEDNESDAYS).start).toBe('2026-11-11');
    expect(tripWindow('2026-11-10', WEDNESDAYS).start).toBe('2026-11-04');
  });

  it('steps to the windows either side', () => {
    const window = tripWindow('2026-11-08', WEDNESDAYS);
    expect(previousTripWindow(window, WEDNESDAYS).start).toBe('2026-10-28');
    expect(nextTripWindow(window, WEDNESDAYS).start).toBe('2026-11-11');
  });

  it('makes a window of one day when trips land on consecutive days', () => {
    const close: ShopSchedule = { trips: ['2026-11-04', '2026-11-05'] };
    expect(tripWindow('2026-11-04', close)).toEqual({ start: '2026-11-04', end: '2026-11-04' });
  });

  it('marks trip days between two dates', () => {
    expect(tripsBetween('2026-11-01', '2026-11-14', { trips: ['2026-11-04', '2026-11-09'] })).toEqual(['2026-11-04', '2026-11-09']);
  });

  it('leaves no day out and none twice, across chosen trips', () => {
    const schedule: ShopSchedule = { trips: ['2026-11-04', '2026-11-07', '2026-11-17'] };
    let window = tripWindow('2026-10-28', schedule);
    for (let i = 0; i < 8; i++) {
      const next = nextTripWindow(window, schedule);
      expect(next.start).toBe(addDays(window.end, 1));
      window = next;
    }
  });
});
