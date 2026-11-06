import { describe, expect, it } from 'vitest';
import { applyReceipt, keepTripList } from './receipts.ts';
import { markBought } from './shopping.ts';
import { putAwayStock, setStockUpList } from './stock-up.ts';
import { failOnce, receiptLine, TODAY, transactionalFakes, TRIP, tripLine } from './test-support/transactional-fakes.ts';

const onList = (f: ReturnType<typeof transactionalFakes>, ...items: { id: number; name: string }[]) =>
  f.deps.receipts.saveTripList(TRIP, items.map(i => tripLine(i.id, i.name)));
const line = (item: { id: number; name: string }, quantity: number | null = 12) => ({ pantryItemId: item.id, name: item.name, quantity });

describe('checking lines off', () => {
  it('adds a counted line once when the same request comes again', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 2 });
    onList(f, eggs);
    markBought(f.deps, [line(eggs)], TODAY);
    markBought(f.deps, [line(eggs)], TODAY);
    expect(f.item(eggs.id).count).toBe(14);
    expect(f.deps.receipts.tripList(TRIP)?.[0]).toMatchObject({ checkedOff: true, addedCount: 12, countAfter: 14 });
  });

  it('adds again when it was used since and bought again', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 2 });
    onList(f, eggs);
    markBought(f.deps, [line(eggs)], TODAY);
    f.deps.pantry.update(eggs.id, { count: 0 });
    markBought(f.deps, [line(eggs)], TODAY);
    expect(f.item(eggs.id).count).toBe(12);
  });

  it('remembers a checked-off count when the saved list is refreshed', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 2 });
    onList(f, eggs);
    markBought(f.deps, [line(eggs)], TODAY);
    keepTripList(f.deps, TRIP, [{ key: `p${eggs.id}`, name: 'eggs', pantryItemId: eggs.id, store: 'aldi', reason: 'needed', neededFor: [] }] as never);
    markBought(f.deps, [line(eggs)], TODAY);
    expect(f.item(eggs.id).count).toBe(14);
  });

  it('checks off everything or nothing', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 2 });
    const milk = f.addItem('milk', { status: 'out' });
    onList(f, eggs, milk);
    failOnce(f.ports.pantry, 'update', ((id: number) => id === milk.id) as never);
    expect(() => markBought(f.deps, [line(eggs), line(milk, null)], TODAY)).toThrow();
    expect(f.item(eggs.id).count).toBe(2);
    expect(f.deps.receipts.tripList(TRIP)?.[0].checkedOff).toBe(false);

    markBought(f.deps, [line(eggs), line(milk, null)], TODAY);
    expect(f.item(eggs.id).count).toBe(14);
    expect(f.item(milk.id).status).toBe('have');
  });

  it('finds an item the list had by name once a retry has created it', () => {
    const f = transactionalFakes();
    const lines = [{ pantryItemId: null, name: 'saffron', quantity: null }];
    markBought(f.deps, lines, TODAY);
    markBought(f.deps, lines, TODAY);
    expect(f.deps.pantry.findByName('saffron')?.status).toBe('have');
  });
});

describe('putting stock away', () => {
  const beefGoal = { stockUp: { amount: 12, unit: 'lb' as const, storage: 'frozen' as const, rank: 0 }, packSize: { count: null, measure: { amount: 3, unit: 'lb' as const } } };

  it('stores a repeated request once', () => {
    const f = transactionalFakes();
    const beef = f.addItem('beef', beefGoal);
    putAwayStock(f.deps, TODAY, beef.id, 2);
    putAwayStock(f.deps, TODAY, beef.id, 2);
    expect(f.item(beef.id).portions.find(p => p.storage === 'frozen')?.amount).toBe(6);
  });

  it('goes with the rest of the check-off', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 2 });
    const beef = f.addItem('beef', beefGoal);
    failOnce(f.ports.pantry, 'setPortions');
    expect(() => markBought(f.deps, [line(eggs)], TODAY, [{ pantryItemId: beef.id, packages: 1 }])).toThrow();
    expect(f.item(eggs.id).count).toBe(2);
  });

  it('replaces the stock-up list all at once', () => {
    const f = transactionalFakes();
    const oil = f.addItem('oil', { stockUp: { amount: 2, unit: null, storage: 'fresh', rank: 0 } });
    const tuna = f.addItem('tuna');
    failOnce(f.ports.pantry, 'update', ((id: number) => id === tuna.id) as never);
    expect(() => setStockUpList(f.deps, [{ pantryItemId: tuna.id, amount: 6, unit: 'can', storage: 'canned' }])).toThrow();
    expect(f.item(oil.id).stockUp).not.toBeNull();
    expect(f.item(tuna.id).stockUp).toBeNull();
  });

  it('sets goals on pantry items in the order given, and takes off the ones left out', () => {
    const f = transactionalFakes();
    const oil = f.addItem('oil', { stockUp: { amount: 2, unit: null, storage: 'fresh', rank: 0 } });
    const tuna = f.addItem('tuna');
    const beef = f.addItem('beef');
    setStockUpList(f.deps, [
      { pantryItemId: beef.id, amount: 10, unit: 'lb', storage: 'frozen' },
      { pantryItemId: tuna.id, amount: 6, unit: 'can', storage: 'canned' },
    ]);
    expect(f.item(beef.id).stockUp).toEqual({ amount: 10, unit: 'lb', storage: 'frozen', rank: 0 });
    expect(f.item(tuna.id).stockUp).toEqual({ amount: 6, unit: 'can', storage: 'canned', rank: 1 });
    expect(f.item(oil.id).stockUp).toBeNull();
  });

  it('never makes a pantry item: an unknown id changes nothing and says so', () => {
    const f = transactionalFakes();
    const oil = f.addItem('oil', { stockUp: { amount: 2, unit: null, storage: 'fresh', rank: 0 } });
    const before = f.deps.pantry.list().length;
    expect(() => setStockUpList(f.deps, [{ pantryItemId: 9999, amount: 6, unit: 'can', storage: 'canned' }])).toThrow(/Pantry/);
    expect(f.deps.pantry.list()).toHaveLength(before);
    expect(f.item(oil.id).stockUp).not.toBeNull();
  });

  it('refuses the same item twice', () => {
    const f = transactionalFakes();
    const oil = f.addItem('oil');
    const goal = { pantryItemId: oil.id, amount: 2, unit: null, storage: 'fresh' as const };
    expect(() => setStockUpList(f.deps, [goal, goal])).toThrow(/twice/);
    expect(f.item(oil.id).stockUp).toBeNull();
  });
});

describe('trying a put-away again', () => {
  const TOKEN = 'put-away-1';
  const AFTER_THE_TRIP = '2026-11-07'; // past midnight: the coming trip is a different one now

  it('adds once when a receipt moved the count in between', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 2 });
    onList(f, eggs);
    markBought(f.deps, [line(eggs)], TODAY, [], TOKEN);
    const lines = [receiptLine('eggs', { pieces: 18 })];
    applyReceipt(f.deps, f.addReceipt({ lines }), [{ index: 0, name: 'eggs' }]);
    expect(f.item(eggs.id).count).toBe(20);

    markBought(f.deps, [line(eggs)], TODAY, [], TOKEN);
    expect(f.item(eggs.id).count).toBe(20);
  });

  it('adds once across midnight, when the trip has moved on', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 2 });
    onList(f, eggs);
    markBought(f.deps, [line(eggs)], TRIP, [], TOKEN);
    markBought(f.deps, [line(eggs)], AFTER_THE_TRIP, [], TOKEN);
    expect(f.item(eggs.id).count).toBe(14);
  });

  it('stores stock once across midnight', () => {
    const f = transactionalFakes();
    const beef = f.addItem('beef', { stockUp: { amount: 12, unit: 'lb', storage: 'frozen', rank: 0 }, packSize: { count: null, measure: { amount: 3, unit: 'lb' } } });
    markBought(f.deps, [], TRIP, [{ pantryItemId: beef.id, packages: 2 }], TOKEN);
    markBought(f.deps, [], AFTER_THE_TRIP, [{ pantryItemId: beef.id, packages: 2 }], TOKEN);
    expect(f.item(beef.id).portions.find(p => p.storage === 'frozen')?.amount).toBe(6);
  });

  it('still does a box ticked since', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 2 });
    const milk = f.addItem('milk', { status: 'out' });
    onList(f, eggs, milk);
    markBought(f.deps, [line(eggs)], TODAY, [], TOKEN);
    markBought(f.deps, [line(eggs), line(milk, null)], TODAY, [], TOKEN);
    expect(f.item(eggs.id).count).toBe(14);
    expect(f.item(milk.id).status).toBe('have');
  });

  it('forgets a token whose put-away failed, so it can try again', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 2 });
    onList(f, eggs);
    failOnce(f.ports.receipts, 'saveTripList');
    expect(() => markBought(f.deps, [line(eggs)], TODAY, [], TOKEN)).toThrow();
    markBought(f.deps, [line(eggs)], TODAY, [], TOKEN);
    expect(f.item(eggs.id).count).toBe(14);
  });

  it('treats a new token as buying more', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 2 });
    onList(f, eggs);
    markBought(f.deps, [line(eggs)], TODAY, [], TOKEN);
    f.deps.pantry.update(eggs.id, { count: 1 });
    markBought(f.deps, [line(eggs)], TODAY, [], 'put-away-2');
    expect(f.item(eggs.id).count).toBe(13);
  });

  it('with no token, still catches a repeat when the saved list didn’t have the line', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 2 });
    markBought(f.deps, [line(eggs)], TODAY);
    markBought(f.deps, [line(eggs)], TODAY);
    expect(f.item(eggs.id).count).toBe(14);
    expect(f.deps.receipts.tripList(TRIP)?.[0]).toMatchObject({ key: `p${eggs.id}`, checkedOff: true, addedCount: 12, countAfter: 14 });
  });

  it('credits a receipt for a check-off the list didn’t have', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 2 });
    markBought(f.deps, [line(eggs)], TODAY);
    const lines = [receiptLine('eggs', { pieces: 12 })];
    applyReceipt(f.deps, f.addReceipt({ lines }), [{ index: 0, name: 'eggs' }]);
    expect(f.item(eggs.id).count).toBe(14);
  });
});
