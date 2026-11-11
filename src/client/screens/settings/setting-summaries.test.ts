import { describe, expect, it } from 'vitest';
import { avoidedSummary, cookingSummary, householdSummary, notificationSummary, shoppingSummary, stockUpSummary } from './setting-summaries.ts';

describe('what a settings row says', () => {
  const profile = { family: 'Two adults', portions: 4, dinnerTime: '6:30 PM', members: [] };

  it('asks for who is eating until someone says', () => {
    expect(householdSummary(profile, false)).toBe('Start here');
    expect(householdSummary(profile, true)).toBe('4 portions · dinner 6:30 PM');
    expect(householdSummary({ ...profile, portions: 1 }, true)).toBe('1 portion · dinner 6:30 PM');
  });

  it('gives the next trip', () => {
    expect(shoppingSummary('2026-11-02', { trips: ['2026-11-06'] })).toBe('Next trip Fri, Nov 6');
  });

  it('shows the first line of the kitchen notes', () => {
    expect(cookingSummary('Butter, never margarine.\nNo cilantro.')).toBe('Butter, never margarine.');
    expect(cookingSummary('  ')).toBe('Nothing written yet');
  });

  it('names what is on the stock-up list', () => {
    expect(stockUpSummary(['ground beef', 'chicken thighs'])).toBe('ground beef, chicken thighs');
    expect(stockUpSummary([])).toBe('Nothing yet');
  });

  it('counts avoided meals', () => {
    expect(avoidedSummary(0)).toBe('Nothing for now');
    expect(avoidedSummary(1)).toBe('1 meal');
    expect(avoidedSummary(3)).toBe('3 meals');
  });

  it('says whether this phone gets notifications', () => {
    const ready = { support: 'ok' as const, serverReady: true, on: true, person: 'Sam' };
    expect(notificationSummary(ready)).toBe('On · Sam’s phone');
    expect(notificationSummary({ ...ready, on: false })).toBe('Off on this phone');
    expect(notificationSummary({ ...ready, serverReady: false })).toBe('Not set up yet');
    expect(notificationSummary({ ...ready, support: 'install' })).toBe('Add to Home Screen first');
  });
});
