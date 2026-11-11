import { describe, expect, it } from 'vitest';
import { buildShoppingList } from '../../domain/shopping.ts';
import { findPantryItem } from '../../domain/pantry.ts';
import { recipe } from '../../domain/test-fixtures.ts';
import { removePantryItem, updatePantryItem } from './pantry.ts';
import { applyReceipt, receiptView, savePricesOnly } from './receipts.ts';
import { receiptLine, transactionalFakes, TRIP, tripLine } from './test-support/transactional-fakes.ts';

function walmartTrip() {
  const f = transactionalFakes();
  const jasmine = f.addItem('jasmine rice', { status: 'out' });
  const breasts = f.addItem('chicken breasts', { status: 'out', occasional: true });
  const milk = f.addItem('milk', { status: 'out' });
  f.deps.receipts.saveTripList(TRIP, [tripLine(jasmine.id, 'jasmine rice'), tripLine(breasts.id, 'chicken breasts'), tripLine(milk.id, 'milk'), tripLine(99, 'lettuce')]);
  const lines = [receiptLine('basmati rice', { cents: 1497 }), receiptLine('chicken thighs', { form: 'fresh', weightLb: 3 }), receiptLine('milk', { pantryItemId: milk.id })];
  const id = f.addReceipt({ lines });
  const kept = lines.map((line, index) => ({ index, name: line.name }));
  return { f, id, kept, jasmine, breasts, milk };
}

const nextList = (f: ReturnType<typeof transactionalFakes>, entries = [] as Parameters<typeof buildShoppingList>[0]['entries'], recipes = new Map()) =>
  buildShoppingList({ entries, recipes, pantry: f.deps.pantry.list(), weekStore: 'aldi', from: '2026-11-07', to: '2026-11-13' }).map(l => l.name);

describe('something bought instead of a list line', () => {
  it('just this time: the list line counts as bought, the pantry holds what was really bought, until it runs out', () => {
    const { f, id, kept, jasmine } = walmartTrip();
    expect(nextList(f)).toContain('jasmine rice');
    applyReceipt(f.deps, id, kept, { substitutes: [{ index: 0, listKey: `p${jasmine.id}`, always: false }] });

    const basmati = f.deps.pantry.findByName('basmati rice')!;
    expect(basmati).toMatchObject({ status: 'have', alsoCalled: ['jasmine rice'] });
    expect(f.item(jasmine.id).status).toBe('out');
    expect(f.savedPrices().map(p => p.itemId)).not.toContain(jasmine.id);
    expect(f.receipt(id)?.lines[0].insteadOf).toBe(`p${jasmine.id}`);
    expect(receiptView(f.deps, id)?.diff.bought.map(b => [b.line.name, b.matched[0].name])).toContainEqual(['jasmine rice', 'basmati rice']);
    expect(receiptView(f.deps, id)?.diff.skipped.map(l => l.name)).toEqual(['chicken breasts', 'lettuce']);

    // Planning and the list take the basmati for jasmine while it lasts.
    expect(findPantryItem('jasmine rice', f.deps.pantry.list())?.name).toBe('basmati rice');
    expect(nextList(f)).not.toContain('jasmine rice');

    updatePantryItem(f.deps, basmati.id, { status: 'out' });
    expect(f.item(basmati.id).alsoCalled).toEqual([]);
    expect(nextList(f)).toContain('jasmine rice');
    expect(f.setting('stand_ins_for_now')).toBeNull();
  });

  it('always fine instead: the name stays when it runs out and comes back with the next one', () => {
    const { f, id, kept, breasts } = walmartTrip();
    applyReceipt(f.deps, id, kept, { substitutes: [{ index: 1, listKey: `p${breasts.id}`, always: true }] });
    const thighs = f.deps.pantry.findByName('chicken thighs')!;
    expect(thighs.portions[0]).toMatchObject({ storage: 'fresh', amount: 3, unit: 'lb' });
    expect(f.item(breasts.id).status).toBe('out');
    const soup = recipe('soup', ['- 1 lb chicken breasts']);
    expect(nextList(f, [{ date: '2026-11-08', slot: 'dinner', kind: 'recipe', recipeSlug: 'soup' } as never], new Map([['soup', soup]]))).not.toContain('chicken breasts');
    updatePantryItem(f.deps, thighs.id, { status: 'out' });
    expect(f.item(thighs.id).alsoCalled).toEqual(['chicken breasts']);
  });

  it('turns a "just this time" into "always" without losing the name, and never makes the family’s own name temporary', () => {
    const { f, id, kept, jasmine } = walmartTrip();
    f.addItem('basmati rice', { alsoCalled: ['Jasmine Rice'] });
    applyReceipt(f.deps, id, kept, { substitutes: [{ index: 0, listKey: `p${jasmine.id}`, always: false }] });
    expect(f.setting('stand_ins_for_now')).toBeNull();
    const basmati = f.deps.pantry.findByName('basmati rice')!;
    updatePantryItem(f.deps, basmati.id, { status: 'out' });
    expect(f.item(basmati.id).alsoCalled).toEqual(['Jasmine Rice']);
  });

  it('drops a substitute for a line the receipt has, a line not kept, or a second line for one list line', () => {
    const { f, id, kept, jasmine, milk } = walmartTrip();
    applyReceipt(f.deps, id, kept.slice(1), {
      substitutes: [
        { index: 0, listKey: `p${jasmine.id}`, always: true },
        { index: 1, listKey: `p${milk.id}`, always: true },
        { index: 1, listKey: 'p99', always: false },
        { index: 2, listKey: 'p99', always: false },
      ],
    });
    expect(f.receipt(id)?.lines.map(l => l.insteadOf ?? null)).toEqual(['p99', null]);
    expect(f.deps.pantry.findByName('basmati rice')).toBeNull();
    expect(f.deps.pantry.findByName('chicken thighs')?.alsoCalled).toEqual(['lettuce']);
    expect(f.item(milk.id).alsoCalled).toEqual([]);
  });

  it('does nothing with Prices only', () => {
    const { f, id, kept, jasmine } = walmartTrip();
    savePricesOnly(f.deps, id, kept, { substitutes: [{ index: 0, listKey: `p${jasmine.id}`, always: true }] });
    expect(f.deps.pantry.findByName('basmati rice')).toBeNull();
    expect(f.setting('stand_ins_for_now')).toBeNull();
  });

  it('forgets a removed item’s stand-ins', () => {
    const { f, id, kept, jasmine } = walmartTrip();
    applyReceipt(f.deps, id, kept, { substitutes: [{ index: 0, listKey: `p${jasmine.id}`, always: false }] });
    removePantryItem(f.deps, f.deps.pantry.findByName('basmati rice')!.id);
    expect(f.setting('stand_ins_for_now')).toBeNull();
  });
});
