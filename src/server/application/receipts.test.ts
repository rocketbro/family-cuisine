import { describe, expect, it } from 'vitest';
import type { PantryItem } from '../../domain/pantry.ts';
import type { ReceiptLine } from '../../domain/receipts.ts';
import { applyReceipt, keepTripList, savePricesOnly } from './receipts.ts';
import { putAwayStock } from './stock-up.ts';
import { markBought } from './shopping.ts';
import { failOnce, receiptLine, TODAY, transactionalFakes, TRIP, tripLine } from './test-support/transactional-fakes.ts';
import { changeTripPlan, tripPlan } from './trip-plan.ts';

const NEXT_TRIP = '2026-11-13';
const kept = (lines: ReceiptLine[]) => lines.map((line, index) => ({ index, name: line.name }));
const threePounds: Partial<PantryItem> = {
  stockUp: { amount: 12, unit: 'lb', storage: 'frozen', rank: 0 },
  packSize: { count: null, measure: { amount: 3, unit: 'lb' } },
};
const portion = (item: PantryItem, storage: string) => item.portions.find(p => p.storage === storage);

describe('saving a receipt', () => {
  it('changes nothing if it fails halfway, and a retry stocks once', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 2 });
    const milk = f.addItem('milk', { status: 'out' });
    const lines = [receiptLine('eggs', { pieces: 12 }), receiptLine('milk')];
    const id = f.addReceipt({ lines });
    failOnce(f.ports.receipts, 'update');

    expect(() => applyReceipt(f.deps, id, kept(lines))).toThrow();
    expect(f.item(eggs.id).count).toBe(2);
    expect(f.item(milk.id).status).toBe('out');
    expect(f.savedPrices()).toEqual([]);
    expect(f.receipt(id)?.status).toBe('ready');

    applyReceipt(f.deps, id, kept(lines));
    expect(f.item(eggs.id).count).toBe(14);
    expect(f.receipt(id)?.status).toBe('applied');
    expect(() => applyReceipt(f.deps, id, kept(lines))).toThrow('already been saved');
    expect(f.item(eggs.id).count).toBe(14);
  });

  it('adds nothing new from a line that fails after creating an item', () => {
    const f = transactionalFakes();
    const lines = [receiptLine('saffron')];
    const id = f.addReceipt({ lines });
    failOnce(f.ports.prices, 'save');
    expect(() => applyReceipt(f.deps, id, kept(lines))).toThrow();
    expect(f.deps.pantry.findByName('saffron')).toBeNull();
  });
});

describe('prices only', () => {
  const file = { file: 'r.jpg', type: 'image/jpeg' as const };

  it('keeps the receipt and its files if saving fails', () => {
    const f = transactionalFakes();
    f.addItem('milk');
    const lines = [receiptLine('milk')];
    const id = f.addReceipt({ lines, files: [file] });
    failOnce(f.ports.receipts, 'remove');
    expect(() => savePricesOnly(f.deps, id, kept(lines))).toThrow();
    expect(f.savedPrices()).toEqual([]);
    expect(f.removedFiles()).toEqual([]);
    expect(f.receipt(id)?.status).toBe('ready');
  });

  it('counts as saved even if a file can’t be removed', () => {
    const f = transactionalFakes();
    f.addItem('milk');
    const lines = [receiptLine('milk')];
    const id = f.addReceipt({ lines, files: [file] });
    failOnce(f.ports.receiptFiles, 'remove');
    savePricesOnly(f.deps, id, kept(lines));
    expect(f.savedPrices()).toHaveLength(1);
    expect(f.receipt(id)).toBeNull();
  });
});

describe('stock-up packages on a receipt', () => {
  const beefLine = (quantity: number) => receiptLine('beef', { quantity, weightLb: quantity * 3, form: 'fresh' });

  it('doesn’t count packages already put away a second time', () => {
    const f = transactionalFakes();
    const beef = f.addItem('beef', threePounds);
    putAwayStock(f.deps, TODAY, beef.id, 2);
    expect(portion(f.item(beef.id), 'frozen')?.amount).toBe(6);

    const lines = [beefLine(2)];
    applyReceipt(f.deps, f.addReceipt({ lines }), kept(lines));
    expect(portion(f.item(beef.id), 'frozen')?.amount).toBe(6);
    expect(portion(f.item(beef.id), 'fresh')).toBeUndefined();
  });

  it('still knows what was put away after the list moves on to the next trip', () => {
    const f = transactionalFakes();
    const beef = f.addItem('beef', threePounds);
    putAwayStock(f.deps, TODAY, beef.id, 2);
    changeTripPlan(f.deps, NEXT_TRIP, () => ({ planned: {} }));

    const lines = [beefLine(2)];
    applyReceipt(f.deps, f.addReceipt({ lines }), kept(lines));
    expect(portion(f.item(beef.id), 'fresh')).toBeUndefined();
  });

  it('splits a line into already recorded, newly stored and the rest', () => {
    const f = transactionalFakes();
    const beef = f.addItem('beef', threePounds);
    changeTripPlan(f.deps, TRIP, () => ({ planned: { [beef.id]: 3 } }));
    putAwayStock(f.deps, TODAY, beef.id, 1);
    expect(portion(f.item(beef.id), 'frozen')?.amount).toBe(3);

    const lines = [beefLine(4)];
    applyReceipt(f.deps, f.addReceipt({ lines }), kept(lines));
    // One was recorded already, two more go to the freezer, and one is for the meals.
    expect(portion(f.item(beef.id), 'frozen')?.amount).toBe(9);
    expect(portion(f.item(beef.id), 'fresh')?.amount).toBe(3);
    expect(tripPlan(f.deps, TRIP)).toMatchObject({ bought: { [beef.id]: 3 }, matched: { [beef.id]: 3 } });
  });

  it('adds only what’s left of a canned line', () => {
    const f = transactionalFakes();
    const beans = f.addItem('beans', { stockUp: { amount: 12, unit: 'can', storage: 'canned', rank: 0 } });
    changeTripPlan(f.deps, TRIP, () => ({ planned: { [beans.id]: 2 } }));
    const lines = [receiptLine('beans', { quantity: 5, form: 'canned' })];
    applyReceipt(f.deps, f.addReceipt({ lines }), kept(lines));
    expect(portion(f.item(beans.id), 'canned')?.amount).toBe(5);
  });

  it('doesn’t let a second receipt claim what the first accounted for', () => {
    const f = transactionalFakes();
    const beef = f.addItem('beef', threePounds);
    putAwayStock(f.deps, TODAY, beef.id, 1);
    const first = [beefLine(1)];
    applyReceipt(f.deps, f.addReceipt({ lines: first }), kept(first));
    const second = [beefLine(1)];
    applyReceipt(f.deps, f.addReceipt({ lines: second }), kept(second));
    expect(portion(f.item(beef.id), 'frozen')?.amount).toBe(3);
    expect(portion(f.item(beef.id), 'fresh')?.amount).toBe(3);
  });

  it('reads a plan saved before trips had their own', () => {
    const f = transactionalFakes();
    const beef = f.addItem('beef', threePounds);
    f.deps.household.saveSetting('trip_plan', JSON.stringify({ trip: TRIP, findsCents: 500, chosen: {}, planned: {}, bought: { [beef.id]: 2 } }));
    expect(tripPlan(f.deps, TRIP)).toMatchObject({ findsCents: 500, bought: { [beef.id]: 2 }, matched: {} });
    expect(tripPlan(f.deps, NEXT_TRIP).bought).toEqual({});
  });
});

describe('a checked-off count on a receipt', () => {
  function checkedOffEggs() {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 2 });
    f.deps.receipts.saveTripList(TRIP, [tripLine(eggs.id, 'eggs')]);
    markBought(f.deps, [{ pantryItemId: eggs.id, name: 'eggs', quantity: 12 }], TODAY);
    expect(f.item(eggs.id).count).toBe(14);
    return { f, eggs };
  }
  const eggLine = (pieces: number) => receiptLine('eggs', { pieces });

  it('is credited once across two receipts', () => {
    const { f, eggs } = checkedOffEggs();
    const first = [eggLine(12)];
    applyReceipt(f.deps, f.addReceipt({ lines: first }), kept(first));
    expect(f.item(eggs.id).count).toBe(14);

    const second = [eggLine(12)];
    applyReceipt(f.deps, f.addReceipt({ lines: second }), kept(second));
    expect(f.item(eggs.id).count).toBe(26);
  });

  it('is credited once across two lines of one receipt', () => {
    const { f, eggs } = checkedOffEggs();
    const lines = [eggLine(12), eggLine(6)];
    applyReceipt(f.deps, f.addReceipt({ lines }), kept(lines));
    expect(f.item(eggs.id).count).toBe(20);
  });

  it('stays credited when the list is saved again', () => {
    const { f, eggs } = checkedOffEggs();
    const first = [eggLine(12)];
    applyReceipt(f.deps, f.addReceipt({ lines: first }), kept(first));
    expect(f.deps.receipts.tripList(TRIP)?.[0]).toMatchObject({ checkedOff: true, addedCount: 0 });
    keepTripList(f.deps, TRIP, []);
    const second = [eggLine(12)];
    applyReceipt(f.deps, f.addReceipt({ lines: second }), kept(second));
    expect(f.item(eggs.id).count).toBe(26);
  });

  it('isn’t credited if saving the receipt fails, so a retry still is', () => {
    const { f, eggs } = checkedOffEggs();
    const lines = [eggLine(12)];
    const id = f.addReceipt({ lines });
    failOnce(f.ports.receipts, 'update');
    expect(() => applyReceipt(f.deps, id, kept(lines))).toThrow();
    expect(f.deps.receipts.tripList(TRIP)?.[0].addedCount).toBe(12);
    applyReceipt(f.deps, id, kept(lines));
    expect(f.item(eggs.id).count).toBe(14);
  });
});
