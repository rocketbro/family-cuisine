import { describe, expect, it } from 'vitest';
import { afterBuying, checkedOffLine, creditCheckOff, mergeTripList, repeatsCheckOff, tripDiff, type ReceiptLine, type TripLine } from './receipts.ts';
import { pantryItem } from './test-fixtures.ts';
import { tripSuggestions } from './trip-learning.ts';

describe('shopping trips', () => {
  const tripLine = (id: number, name: string, over: Partial<TripLine> = {}): TripLine => ({ key: `p${id}`, name, pantryItemId: id, store: 'aldi', reason: 'needed', neededFor: [], checkedOff: false, addedCount: 0, ...over });
  const bought = (name: string, pantryItemId: number | null, over: Partial<ReceiptLine> = {}): ReceiptLine => ({ printed: name.toUpperCase(), name, pantryItemId, category: 'Pantry', quantity: 1, pieces: null, form: null, canOz: null, weightLb: null, lastsDays: null, cents: 199, unsure: false, ...over });
  const canned = { storage: 'canned' as const, amount: 2, unit: 'can' as const, canOz: 15.5, useBy: null, useByEstimated: false };

  it('sorts a trip into bought, skipped and extra', () => {
    const list = [tripLine(1, 'milk'), tripLine(2, 'eggs'), tripLine(3, 'paper towels', { store: 'walmart' })];
    const diff = tripDiff(list, [{ store: 'aldi', lines: [bought('milk', 1), bought('gum', null)] }]);
    expect(diff.bought.map(b => b.line.name)).toEqual(['milk']);
    expect(diff.skipped.map(l => l.name)).toEqual(['eggs']);
    expect(diff.extras.map(l => l.name)).toEqual(['gum']);
  });
  it('matches new items by name', () => {
    const diff = tripDiff([tripLine(1, 'Pinto Beans', { pantryItemId: null })], [{ store: 'aldi', lines: [bought('pinto bean', 7)] }]);
    expect(diff.bought).toHaveLength(1);
  });
  it('keeps checked-off lines on the record after they leave the list', () => {
    const saved = [tripLine(1, 'milk', { checkedOff: true }), tripLine(2, 'eggs', { checkedOff: true, addedCount: 12 }), tripLine(3, 'gum')];
    const merged = mergeTripList(saved, [tripLine(2, 'eggs')]);
    expect(merged.map(l => l.name)).toEqual(['eggs', 'milk']);
    expect(merged[0].addedCount).toBe(12);
  });
  it('adds exactly what was bought', () => {
    expect(afterBuying(pantryItem(1, 'eggs', { count: 3 }), bought('eggs', 1, { pieces: 18 }))).toEqual({ count: 21 });
    expect(afterBuying(pantryItem(1, 'eggs', { count: 15 }), bought('eggs', 1, { pieces: 18 }), 12)).toEqual({ count: 21 });
    expect(afterBuying(pantryItem(1, 'beans', { portions: [canned] }), bought('beans', 1, { quantity: 4 })).portions).toEqual([{ storage: 'canned', amount: 6, unit: 'can', canOz: 15.5 }]);
    expect(afterBuying(pantryItem(1, 'tuna'), bought('tuna', 1, { form: 'canned', quantity: 2, canOz: 5 })).portions).toEqual([{ storage: 'canned', amount: 2, unit: 'can', canOz: 5 }]);
    expect(afterBuying(pantryItem(1, 'lentils'), bought('lentils', 1, { form: 'dried', weightLb: 1 })).portions).toEqual([{ storage: 'dried', amount: 1, unit: 'lb' }]);
    expect(afterBuying(pantryItem(1, 'milk'), bought('milk', 1))).toEqual({});
  });
  it('suggests changes only after a habit shows, and never again once dismissed', () => {
    const gum = pantryItem(1, 'gum', { occasional: true });
    const towels = pantryItem(2, 'paper towels');
    const trip = { bought: [], skipped: [tripLine(2, 'paper towels', { reason: 'restock' })], extras: [bought('gum', 1)] };
    expect(tripSuggestions([trip, trip], [gum, towels], new Set())).toEqual([]);
    expect(tripSuggestions([trip, trip, trip], [gum, towels], new Set()).map(s => s.key)).toEqual(['keep-stocked:1', 'as-needed:2']);
    expect(tripSuggestions([trip, trip, trip], [gum, towels], new Set(['keep-stocked:1'])).map(s => s.key)).toEqual(['as-needed:2']);
  });
  it('doesn’t read skipping a recipe’s ingredient as a habit', () => {
    const trip = { bought: [], skipped: [tripLine(2, 'capers', { reason: 'needed' })], extras: [] };
    expect(tripSuggestions([trip, trip, trip], [pantryItem(2, 'capers')], new Set())).toEqual([]);
  });
});

describe('checking a line off again', () => {
  it('is a repeat while the count is what checking it off left', () => {
    expect(repeatsCheckOff({ checkedOff: true, countAfter: 12 }, 12)).toBe(true);
  });
  it('is a new purchase once the count has moved, or when nothing was recorded', () => {
    expect(repeatsCheckOff({ checkedOff: true, countAfter: 12 }, 3)).toBe(false);
    expect(repeatsCheckOff({ checkedOff: false }, 12)).toBe(false);
    expect(repeatsCheckOff(undefined, 12)).toBe(false);
  });
});

describe('crediting a check-off against a receipt', () => {
  const line = { key: 'p1', name: 'eggs', pantryItemId: 1, store: 'aldi' as const, reason: 'needed' as const, neededFor: [], checkedOff: true, addedCount: 12 };
  it('gives the amount once', () => {
    const first = creditCheckOff([line], 1);
    expect(first.added).toBe(12);
    expect(creditCheckOff(first.list, 1).added).toBe(0);
  });
  it('gives nothing for a line that wasn’t checked off, or another item', () => {
    expect(creditCheckOff([{ ...line, checkedOff: false }], 1).added).toBe(0);
    expect(creditCheckOff([line], 2).added).toBe(0);
  });
  it('keys a line the list didn’t have the way the list would', () => {
    expect(checkedOffLine({ name: 'eggs', pantryItemId: 1 }, 'aldi').key).toBe('p1');
    expect(checkedOffLine({ name: 'Saffron', pantryItemId: null }, 'aldi').key).toBe('n:saffron');
  });
});
