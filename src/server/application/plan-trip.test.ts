// "Plan the rest of this trip" fills the window on show and no further.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dateRange } from '../../domain/dates.ts';
import { mealsOnly } from '../../domain/plan-slot.ts';
import { pantryItem, recipe } from '../../domain/test-fixtures.ts';
import { planTrip } from './planning.ts';
import { fakeDeps } from './test-support/full-deps-fake.ts';

// A Tuesday, with shopping on Wednesdays: this window ends today, and the next runs the 4th through the 10th.
const TODAY = '2026-11-03';
const WEDNESDAY = 3;

const stocked = () => fakeDeps({
  ai: false,
  shopWeekday: WEDNESDAY,
  recipes: [recipe('soup', ['- 1 cup broth'], { meals: ['breakfast', 'lunch', 'dinner'] })],
  pantry: [pantryItem(1, 'broth')],
});
const plannedDays = (deps: ReturnType<typeof fakeDeps>) => [...new Set(mealsOnly(deps.plan.range(TODAY, '9999-12-31')).map(entry => entry.date))];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-03T12:00:00'));
});
afterEach(() => void vi.useRealTimers());

describe('planning one trip', () => {
  it('stops at the end of the window holding today, short of the next one', async () => {
    const deps = stocked();
    await planTrip(deps, TODAY, TODAY);
    expect(plannedDays(deps)).toEqual([TODAY]);
  });

  it('reaches a later window when that is the one on show', async () => {
    const deps = stocked();
    await planTrip(deps, TODAY, '2026-11-18');
    expect(plannedDays(deps)).toEqual(dateRange(TODAY, '2026-11-24'));
  });

  it('follows a moved trip', async () => {
    const deps = stocked();
    deps.household.shopTrips = () => ['2026-11-05'];
    await planTrip(deps, TODAY, TODAY);
    expect(plannedDays(deps)).toEqual([TODAY, '2026-11-04']);
  });

  it('refuses a date far ahead rather than planning up to it', () => {
    const deps = stocked();
    expect(() => planTrip(deps, TODAY, '2099-01-01')).toThrow('too far ahead');
    expect(plannedDays(deps)).toEqual([]);
  });
});
