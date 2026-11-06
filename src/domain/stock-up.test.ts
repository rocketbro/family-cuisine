import { describe, expect, it } from 'vitest';
import { budgetRoom } from './prices.ts';
import { remainderOfLine, type ReceiptLine } from './receipts.ts';
import { amountStored, fillStockUp, heldForGoal, splitForStock, stockStanding, type StockGoal } from './stock-up.ts';
import { pantryItem } from './test-fixtures.ts';

describe('a stock-up line on a receipt', () => {
  it('takes what was put away first, then what is waiting, and leaves the rest for meals', () => {
    expect(splitForStock(5, { planned: 3, bought: 2, matched: 0 })).toEqual({ recorded: 2, stored: 1, remainder: 2 });
  });
  it('adds nothing for packages already put away', () => {
    expect(splitForStock(2, { planned: 0, bought: 2, matched: 0 })).toEqual({ recorded: 2, stored: 0, remainder: 0 });
  });
  it('does not let a second receipt claim what an earlier one matched', () => {
    expect(splitForStock(1, { planned: 2, bought: 1, matched: 1 })).toEqual({ recorded: 0, stored: 1, remainder: 0 });
    expect(splitForStock(1, { planned: 0, bought: 2, matched: 2 })).toEqual({ recorded: 0, stored: 0, remainder: 1 });
  });
  it('scales what is left of the line', () => {
    const line = { quantity: 4, pieces: 48, weightLb: 8 } as ReceiptLine;
    expect(remainderOfLine(line, 1)).toMatchObject({ quantity: 1, pieces: 12, weightLb: 2 });
    expect(remainderOfLine(line, 4)).toBe(line);
  });
});

describe('where a goal stands', () => {
  const goal: StockGoal = { amount: 10, unit: 'lb', storage: 'frozen', rank: 0 };
  const portion = (amount: number | null, unit: 'lb' | 'can' = 'lb') => ({ storage: 'frozen' as const, amount, unit, canOz: null, useBy: null, useByEstimated: false });

  it('says what is there, the goal and how far along it is', () => {
    expect(stockStanding({ portions: [portion(3)] }, goal)).toEqual({ have: 'Have 3 lb frozen', goal: 'Goal 10 lb', share: 0.3 });
  });
  it('says so when there is none of that kind', () => {
    expect(stockStanding({ portions: [] }, goal)).toMatchObject({ have: 'None frozen yet', share: 0 });
  });
  it('counts an unknown amount or one it cannot compare as no progress, and still says what is there', () => {
    expect(stockStanding({ portions: [portion(null)] }, goal)).toMatchObject({ have: 'Have some frozen', share: 0 });
    expect(stockStanding({ portions: [portion(2, 'can')] }, goal)).toMatchObject({ have: 'Have 2 cans frozen', share: 0 });
  });
  it('stops at full when there is more than the goal', () => {
    expect(stockStanding({ portions: [portion(12)] }, goal).share).toBe(1);
  });
});

describe('stocking up', () => {
  const goal = (rank: number): StockGoal => ({ amount: 10, unit: 'lb', storage: 'frozen', rank });
  const frozen = (amount: number) => [{ storage: 'frozen' as const, amount, unit: 'lb' as const, canOz: null, useBy: null, useByEstimated: false }];
  const beef = pantryItem(1, 'ground beef', { stockUp: goal(0), portions: frozen(3), packSize: { count: null, measure: { amount: 3, unit: 'lb' } } });
  const chicken = pantryItem(2, 'chicken', { stockUp: goal(1), portions: frozen(8), packSize: { count: null, measure: { amount: 5, unit: 'lb' } } });
  const fill = (spendable: number | null, extra: Partial<Parameters<typeof fillStockUp>[0]> = {}) => fillStockUp({
    items: [chicken, beef], storeFor: () => 'walmart', priceOf: item => (item.id === 1 ? 1500 : 1000), spendable, chosen: {}, bought: {}, ...extra,
  });
  const packages = (lines: ReturnType<typeof fill>) => lines.map(l => [l.name, l.packages]);

  it('reads what is held', () => {
    expect(heldForGoal(beef, goal(0))).toBe(3);
  });
  it('spends in priority order, a package at a time, up to the goal', () => {
    expect(packages(fill(3000))).toEqual([['ground beef', 1], ['chicken', 1]]);
    expect(packages(fill(1500))).toEqual([['ground beef', 1], ['chicken', 0]]);
    expect(packages(fill(100_000))).toEqual([['ground beef', 3], ['chicken', 1]]);
  });
  it('buys nothing when there is no telling what is left, but shows what is short', () => {
    expect(packages(fill(null))).toEqual([['ground beef', 0], ['chicken', 0]]);
  });
  it('keeps numbers people set, and spends the rest around them', () => {
    expect(packages(fill(3000, { chosen: { 1: 0 } }))).toEqual([['ground beef', 0], ['chicken', 1]]);
    expect(packages(fill(0, { chosen: { 1: 2 } }))).toEqual([['ground beef', 2], ['chicken', 0]]);
  });
  it('leaves out what has already been bought, or has reached the goal', () => {
    expect(packages(fill(3000, { bought: { 1: 1 } }))).toEqual([['chicken', 1]]);
    const full = pantryItem(3, 'beans', { stockUp: goal(2), portions: frozen(10) });
    expect(fill(3000, { items: [full] })).toEqual([]);
  });
  it('skips what has no price', () => {
    expect(packages(fill(3000, { priceOf: item => (item.id === 1 ? null : 1000) }))).toEqual([['ground beef', 0], ['chicken', 1]]);
  });
  it('works out what a purchase adds to the store', () => {
    expect(amountStored(beef, goal(0), 2, null, 1)).toBe(6);
    expect(amountStored(beef, goal(0), 1, 8, 0.5)).toBe(4);
    expect(amountStored(pantryItem(4, 'x'), goal(0), 1, null, 1)).toBeNull();
  });
  it('only trusts the room when enough prices are known', () => {
    expect(budgetRoom(10_000, { cents: 7000, priced: 9, unpriced: 2 }, 7100)).toBe(2900);
    expect(budgetRoom(10_000, { cents: 7000, priced: 9, unpriced: 3 }, 7100)).toBeNull();
    expect(budgetRoom(null, { cents: 7000, priced: 9, unpriced: 0 }, 7100)).toBeNull();
    expect(budgetRoom(5000, { cents: 7000, priced: 9, unpriced: 0 }, 7100)).toBe(0);
  });
});
