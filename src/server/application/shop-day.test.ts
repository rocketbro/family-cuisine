import { describe, expect, it } from 'vitest';
import { moveTrip } from './shop-day.ts';
import { shopSchedule } from './shop-schedule.ts';
import { sentToCart, noteSentToCart } from './walmart-cart.ts';
import { changeTripPlan, tripPlan } from './trip-plan.ts';
import { nextTrip } from '../../domain/shop-schedule.ts';
import { fakeDeps } from './test-support/full-deps-fake.ts';

const TODAY = '2026-11-03'; // a Tuesday; the fake household shops on Wednesdays
const TRIP = '2026-11-04';
const LATER = '2026-11-06';

describe('putting a trip on another day', () => {
  it('counts weeks on from the new day', async () => {
    const deps = fakeDeps();
    await moveTrip(deps, TODAY, TRIP, LATER);
    expect(nextTrip(TODAY, shopSchedule(deps))).toBe(LATER);
    expect(nextTrip('2026-11-07', shopSchedule(deps))).toBe('2026-11-13');
  });

  it('takes what’s kept for the trip with it', async () => {
    const deps = fakeDeps();
    const stores = new Map<string, 'aldi' | 'walmart'>([[TRIP, 'walmart']]);
    deps.household.storeFor = date => stores.get(date) ?? null;
    deps.household.setStore = (date, store) => void stores.set(date, store);
    changeTripPlan(deps, TRIP, () => ({ findsCents: 500 }));
    noteSentToCart(deps, TODAY, [{ itemId: '1', quantity: 2 }]);
    await moveTrip(deps, TODAY, TRIP, LATER);
    expect(deps.household.storeFor(LATER)).toBe('walmart');
    expect(tripPlan(deps, LATER).findsCents).toBe(500);
    expect(sentToCart(deps, LATER)).toEqual({ 1: 2 });
  });

  it('lets someone say today’s trip didn’t happen', async () => {
    const deps = fakeDeps();
    await moveTrip(deps, TRIP, TRIP, LATER);
    expect(nextTrip(TRIP, shopSchedule(deps))).toBe(LATER);
  });

  it('refuses the past, the far future, a day that isn’t a trip, and a day at or before the last trip', async () => {
    const deps = fakeDeps();
    await expect(moveTrip(deps, TODAY, TRIP, '2026-11-02')).rejects.toThrow('today or a day ahead');
    await expect(moveTrip(deps, TODAY, TRIP, '2027-06-01')).rejects.toThrow('next eight weeks');
    await expect(moveTrip(deps, TODAY, '2026-11-05', LATER)).rejects.toThrow('isn’t on the calendar');
    await expect(moveTrip(deps, TODAY, '2026-11-11', TRIP)).rejects.toThrow('after the trip before it');
  });
});
