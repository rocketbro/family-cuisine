import { describe, expect, it } from 'vitest';
import { clockText, cleanHousehold, DEFAULT_PORTIONS, householdIsSetUp, readHousehold } from './household.ts';
import { portionsMultiplier } from './plan.ts';
import { rotationPlan } from './rotation-planner.ts';

const AT = '6:30 PM';

describe('reading the household', () => {
  it('starts generic with nothing saved, and asks to be set up', () => {
    const fresh = readHousehold(null, AT);
    expect(fresh).toEqual({ family: '', portions: DEFAULT_PORTIONS, dinnerTime: AT, members: [] });
    expect(householdIsSetUp(fresh)).toBe(false);
  });
  it('reads what was written straight to the settings table', () => {
    const saved = JSON.stringify({ family: 'Two adults and a baby', portions: 3, dinnerTime: '5:45 PM', members: ['Sam', 'Alex'] });
    const profile = readHousehold(saved, AT);
    expect(profile).toEqual({ family: 'Two adults and a baby', portions: 3, dinnerTime: '5:45 PM', members: ['Sam', 'Alex'] });
    expect(householdIsSetUp(profile)).toBe(true);
  });
  it('falls back on anything missing or unreadable, rather than breaking planning', () => {
    expect(readHousehold('not json', AT).portions).toBe(DEFAULT_PORTIONS);
    expect(readHousehold('null', AT).dinnerTime).toBe(AT);
    expect(readHousehold('{"portions":"lots"}', AT).portions).toBe(DEFAULT_PORTIONS);
    expect(readHousehold('{"portions":0}', AT).portions).toBe(DEFAULT_PORTIONS);
    expect(readHousehold('{"portions":100}', AT).portions).toBe(DEFAULT_PORTIONS);
    expect(readHousehold('{"members":"Sam"}', AT).members).toEqual([]);
  });
  it('tidies names and text', () => {
    expect(cleanHousehold({ family: '  us  ', members: [' Sam ', '', 'Sam', 'Alex'] }, AT)).toMatchObject({ family: 'us', members: ['Sam', 'Alex'] });
  });
});

describe('portions set the batch', () => {
  it('matches the old fixed behavior at four portions', () => {
    expect(portionsMultiplier(4, 4)).toBe(1);
    expect(portionsMultiplier(2, 4)).toBe(2);
    expect(portionsMultiplier(3, 4)).toBe(1.5);
    expect(portionsMultiplier(8, 4)).toBe(1);
    expect(portionsMultiplier(0, 4)).toBe(1);
  });
  it('follows the household size', () => {
    expect(portionsMultiplier(4, 2)).toBe(1); // never less than one batch
    expect(portionsMultiplier(4, 6)).toBe(1.5);
    expect(portionsMultiplier(4, 8)).toBe(2);
  });
  it('reaches the rotation planner', () => {
    const recipes = [{ slug: 'soup', meals: ['dinner' as const], kind: 'recipe' as const, batch: false, serves: 4 }];
    const plan = (portions?: number) => rotationPlan({ dates: ['2026-11-04'], recipes, existing: [], portions })[0].multiplier;
    expect(plan()).toBe(1);
    expect(plan(8)).toBe(2);
  });
});

describe('clock text', () => {
  it('reads like a clock', () => {
    expect(clockText({ hour: 19, minute: 45 })).toBe('7:45 PM');
    expect(clockText({ hour: 8, minute: 0 })).toBe('8:00 AM');
    expect(clockText({ hour: 0, minute: 5 })).toBe('12:05 AM');
    expect(clockText({ hour: 12, minute: 0 })).toBe('12:00 PM');
  });
});
