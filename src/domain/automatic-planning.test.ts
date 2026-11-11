import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTOMATIC_PLANNING, nightlyRuns, plansOnItsOwn, readAutomaticPlanning, tripMorningRuns } from './automatic-planning.ts';

describe('automatic planning', () => {
  it('is on until someone says otherwise, whatever was saved', () => {
    expect(readAutomaticPlanning(null)).toEqual(DEFAULT_AUTOMATIC_PLANNING);
    expect(readAutomaticPlanning('not json')).toEqual(DEFAULT_AUTOMATIC_PLANNING);
    expect(readAutomaticPlanning('{"nightly":false}')).toEqual({ tripMorning: true, nightly: false, held: false });
  });

  it('holds everything after a clear, and keeps the switches for later', () => {
    const held = { tripMorning: true, nightly: true, held: true };
    expect([tripMorningRuns(held), nightlyRuns(held), plansOnItsOwn(held)]).toEqual([false, false, false]);
  });

  it('runs what’s on', () => {
    const nightOnly = { tripMorning: false, nightly: true, held: false };
    expect([tripMorningRuns(nightOnly), nightlyRuns(nightOnly), plansOnItsOwn(nightOnly)]).toEqual([false, true, true]);
    expect(plansOnItsOwn({ tripMorning: false, nightly: false, held: false })).toBe(false);
  });
});
