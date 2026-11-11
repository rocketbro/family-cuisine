import { describe, expect, it } from 'vitest';
import { moveDays } from './meal-move-days.ts';
import type { ShopSchedule } from './shop-schedule.ts';

// Trips on Fridays: Nov 6 and Nov 13.
const schedule: ShopSchedule = { trips: ['2026-11-06', '2026-11-13'], fallbackWeekday: 5 } as unknown as ShopSchedule;

describe('the days offered for a move', () => {
  it('is the rest of the trip, without its own day or past days', () => {
    expect(moveDays('2026-11-08', '2026-11-07', schedule)).toEqual(['2026-11-07', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
  });

  it('still reaches past the trip’s end from its last days', () => {
    expect(moveDays('2026-11-12', '2026-11-12', schedule)).toEqual(['2026-11-13', '2026-11-14', '2026-11-15']);
  });

  it('starts from today for a meal on a past day', () => {
    expect(moveDays('2026-11-03', '2026-11-05', schedule)).toEqual(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  });
});
