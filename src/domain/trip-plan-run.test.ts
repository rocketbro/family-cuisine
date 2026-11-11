import { describe, expect, it } from 'vitest';
import { receiptPromptDue, tripNoticeFits, tripPlanDue } from './trip-plan-run.ts';

const WEDNESDAYS = { trips: ['2026-11-04'] };
const EIGHT = 8 * 60;

describe('when the trip plan is due', () => {
  it('waits for its time on the morning of the trip', () => {
    expect(tripPlanDue('2026-11-11', EIGHT - 1, WEDNESDAYS, EIGHT)).toBeNull();
    expect(tripPlanDue('2026-11-11', EIGHT, WEDNESDAYS, EIGHT)).toBe('2026-11-11');
  });

  it('stays due under the trip’s own date until the next trip', () => {
    expect(tripPlanDue('2026-11-17', 0, WEDNESDAYS, EIGHT)).toBe('2026-11-11');
  });

  it('follows a moved trip', () => {
    const moved = { trips: ['2026-11-04', '2026-11-13'] };
    expect(tripPlanDue('2026-11-11', EIGHT, moved, EIGHT)).toBe('2026-11-04');
    expect(tripPlanDue('2026-11-13', EIGHT, moved, EIGHT)).toBe('2026-11-13');
  });
});

describe('the notice that the meals are planned', () => {
  it('goes out that morning and not later', () => {
    expect(tripNoticeFits('2026-11-11', '2026-11-11', EIGHT, EIGHT)).toBe(true);
    expect(tripNoticeFits('2026-11-11', '2026-11-11', 12 * 60, EIGHT)).toBe(false);
    expect(tripNoticeFits('2026-11-11', '2026-11-12', EIGHT, EIGHT)).toBe(false);
  });
});

describe('the evening receipt prompt', () => {
  const CHECKIN = 19 * 60 + 45;
  it('comes in the hour before the check-in, on a trip day only', () => {
    expect(receiptPromptDue('2026-11-11', CHECKIN - 60, WEDNESDAYS, CHECKIN)).toBe(true);
    expect(receiptPromptDue('2026-11-11', CHECKIN - 61, WEDNESDAYS, CHECKIN)).toBe(false);
    expect(receiptPromptDue('2026-11-11', CHECKIN, WEDNESDAYS, CHECKIN)).toBe(false);
    expect(receiptPromptDue('2026-11-12', CHECKIN - 30, WEDNESDAYS, CHECKIN)).toBe(false);
  });
});
