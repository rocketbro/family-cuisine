import { describe, expect, it } from 'vitest';
import { forgetNeverAdd, neverAddList } from './never-add.ts';
import { applyReceipt, receiptView, savePricesOnly } from './receipts.ts';
import { receiptLine, transactionalFakes, TRIP, tripLine } from './test-support/transactional-fakes.ts';

const ERASER = 'Mr. Clean Magic Eraser Original, 4 Count';
const eraser = (over = {}) => receiptLine('Magic Eraser', { printed: ERASER, ...over });

describe('never adding something off a receipt', () => {
  it('remembers it on Save, under the name they gave, and leaves it off the next receipt', () => {
    const f = transactionalFakes();
    const lines = [receiptLine('milk'), eraser()];
    const first = f.addReceipt({ lines });
    applyReceipt(f.deps, first, [{ index: 0, name: 'milk' }], { neverAdd: [{ index: 1, name: 'magic eraser' }] });
    expect(neverAddList(f.deps)).toEqual([{ id: 1, printed: ERASER, name: 'magic eraser' }]);
    expect(f.deps.pantry.findByName('magic eraser')).toBeNull();

    const next = f.addReceipt({ lines: [receiptLine('bread'), eraser({ name: 'cleaning pads' }), receiptLine('Magic Eraser Bath Scrubber')] });
    expect(receiptView(f.deps, next)?.leftOut).toEqual([1]);
  });

  it('changes nothing before Save, and a failed save remembers nothing', () => {
    const f = transactionalFakes();
    const id = f.addReceipt({ lines: [eraser()] });
    expect(neverAddList(f.deps)).toEqual([]);
    f.ports.receipts.update = () => { throw new Error('disk I/O error'); };
    expect(() => applyReceipt(f.deps, id, [], { neverAdd: [{ index: 0, name: 'Magic Eraser' }] })).toThrow();
    expect(neverAddList(f.deps)).toEqual([]);
  });

  it('won’t remember or leave off anything on the list or in the pantry, or a line they kept', () => {
    const f = transactionalFakes();
    const sponges = f.addItem('sponges');
    f.deps.receipts.saveTripList(TRIP, [tripLine(99, 'dish soap')]);
    const lines = [receiptLine('sponges', { pantryItemId: sponges.id }), receiptLine('dish soap'), eraser(), receiptLine('foil')];
    const id = f.addReceipt({ lines });
    applyReceipt(f.deps, id, [{ index: 2, name: 'Magic Eraser' }], {
      neverAdd: [{ index: 0, name: 'sponges' }, { index: 1, name: 'dish soap' }, { index: 2, name: 'Magic Eraser' }, { index: 3, name: 'sponges' }],
    });
    expect(neverAddList(f.deps)).toEqual([]);
  });

  it('leaves off nothing the pantry has come to know since', () => {
    const f = transactionalFakes();
    f.deps.household.saveSetting('never_add', JSON.stringify([{ id: 1, printed: ERASER, name: 'Magic Eraser' }]));
    const item = f.addItem('Magic Eraser');
    const id = f.addReceipt({ lines: [eraser(), eraser({ pantryItemId: item.id })] });
    expect(receiptView(f.deps, id)?.leftOut).toEqual([]);
  });

  it('remembers it with Prices only too, and forgets it from Settings', () => {
    const f = transactionalFakes();
    const id = f.addReceipt({ lines: [eraser()] });
    savePricesOnly(f.deps, id, [], { neverAdd: [{ index: 0, name: 'Magic Eraser' }] });
    expect(neverAddList(f.deps)).toHaveLength(1);
    forgetNeverAdd(f.deps, 1);
    expect(neverAddList(f.deps)).toEqual([]);
  });
});
