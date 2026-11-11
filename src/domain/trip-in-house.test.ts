import { describe, expect, it } from 'vitest';
import { recipeAvailability } from './availability.ts';
import type { TripLine } from './receipts.ts';
import { pantryAfterMeal } from './running-pantry.ts';
import { withTripMoved } from './shop-schedule.ts';
import { pantryItem, recipe } from './test-fixtures.ts';
import { latestTripGone, pantryWithTripList, tripRecorded } from './trip-in-house.ts';

const line = (name: string, pantryItemId: number | null, over: Partial<TripLine> = {}): TripLine => ({
  key: name, name, pantryItemId, store: 'aldi', reason: 'needed', neededFor: [], checkedOff: false, addedCount: 0, ...over,
});
const needs = (lines: string[]) => recipe('r', lines).ingredients;
const fresh = (amount: number) => ({ storage: 'fresh' as const, amount, unit: 'lb' as const, canOz: null, useBy: null, useByEstimated: false });
const frozen = { ...fresh(2), storage: 'frozen' as const };

const WED = '2026-11-11';
const schedule = { trips: [WED, '2026-11-18'] };

describe('the latest trip that has happened', () => {
  it('is the trip, from the day after it', () => {
    expect(latestTripGone('2026-11-12', schedule)).toBe(WED);
    expect(latestTripGone('2026-11-17', schedule)).toBe(WED);
  });
  it('isn’t on a trip’s own day: that one hasn’t happened, and the last one ended', () => {
    expect(latestTripGone(WED, schedule)).toBeNull();
    expect(latestTripGone('2026-11-18', schedule)).toBeNull();
  });
  it('isn’t a trip moved away: nothing counts until its new day has gone', () => {
    const moved = { trips: withTripMoved(schedule.trips, WED, '2026-11-14') };
    expect(latestTripGone('2026-11-12', moved)).not.toBe(WED);
    expect(latestTripGone('2026-11-14', moved)).toBeNull();
    expect(latestTripGone('2026-11-15', moved)).toBe('2026-11-14');
  });
});

describe('a trip on the record', () => {
  const list = [line('milk', 1)];
  it('isn’t, with nothing put away and no receipt saved', () => {
    expect(tripRecorded(WED, list, {}, [])).toBe(false);
    expect(tripRecorded(WED, list, {}, [{ shopDate: WED, status: 'ready' }, { shopDate: WED, status: 'reading' }])).toBe(false);
  });
  it('is, once something on the list is put away', () => {
    expect(tripRecorded(WED, [line('milk', 1, { checkedOff: true })], {}, [])).toBe(true);
  });
  it('is, once something bought to stock up is put away', () => {
    expect(tripRecorded(WED, list, { 4: 1 }, [])).toBe(true);
  });
  it('is, once a receipt for that trip is applied, and not for another trip’s', () => {
    expect(tripRecorded(WED, list, {}, [{ shopDate: WED, status: 'applied' }])).toBe(true);
    expect(tripRecorded(WED, list, {}, [{ shopDate: '2026-11-04', status: 'applied' }])).toBe(false);
  });
});

describe('the pantry with the list come home', () => {
  it('has what was out', () => {
    const house = pantryWithTripList([pantryItem(1, 'tortillas', { status: 'out' })], [line('tortillas', 1)]);
    expect(recipeAvailability(needs(['- tortillas']), house).level).toBe('ready');
  });
  it('has what no item stands for yet', () => {
    expect(recipeAvailability(needs(['- tortillas']), []).level).not.toBe('ready');
    const house = pantryWithTripList([], [line('tortillas', null)]);
    expect(recipeAvailability(needs(['- tortillas']), house).level).toBe('ready');
    expect(new Set(pantryWithTripList([], [line('a', null), line('b', null)]).map(p => p.id)).size).toBe(2);
  });
  it('finds an item made since the list was saved', () => {
    const house = pantryWithTripList([pantryItem(1, 'salsa', { status: 'out' })], [line('salsa', null)]);
    expect(house).toHaveLength(1);
    expect(house[0].status).toBe('have');
  });
  it('adds what a counted line wanted, or a dozen when it doesn’t say, and that comes down as meals are planned', () => {
    const [wanted] = pantryWithTripList([pantryItem(1, 'eggs', { count: 2 })], [line('eggs', 1, { quantity: 16 })]);
    expect(wanted.count).toBe(18);
    expect(recipeAvailability(needs(['- 18 eggs']), [wanted]).level).toBe('ready');
    const [unsaid] = pantryWithTripList([pantryItem(1, 'eggs', { count: 2 })], [line('eggs', 1)]);
    expect(unsaid.count).toBe(14);
    expect(pantryAfterMeal([unsaid], needs(['- 6 eggs']))[0].count).toBe(8);
  });
  it('stops knowing how much of what’s kept in portions, and leaves the freezer alone', () => {
    const [beef] = pantryWithTripList([pantryItem(1, 'beef', { portions: [fresh(0.5), frozen], status: 'low' })], [line('beef', 1)]);
    expect(beef.status).toBe('have');
    expect(beef.portions).toEqual([{ ...fresh(0.5), amount: null }, frozen]);
    expect(recipeAvailability(needs(['- 3 lb beef']), [beef]).level).toBe('ready');
  });
  it('adds a fresh portion to what’s only frozen', () => {
    const [beef] = pantryWithTripList([pantryItem(1, 'beef', { portions: [frozen] })], [line('beef', 1)]);
    expect(beef.portions.map(p => p.storage)).toEqual(['frozen', 'fresh']);
    expect(recipeAvailability(needs(['- 3 lb beef']), [beef]).level).toBe('ready');
  });
  it('leaves the rest of the pantry and the pantry it was given alone', () => {
    const pantry = [pantryItem(1, 'milk', { status: 'out' }), pantryItem(2, 'beans', { status: 'out' })];
    const house = pantryWithTripList(pantry, [line('milk', 1)]);
    expect(house[1].status).toBe('out');
    expect(pantry[0].status).toBe('out');
  });
});
