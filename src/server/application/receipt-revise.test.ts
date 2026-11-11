import { describe, expect, it, vi } from 'vitest';
import { reviewRows, type SaidRow } from '../../domain/receipt-review.ts';
import { recipe } from '../../domain/test-fixtures.ts';
import type { SaidReceiptRevision } from './ports/ai.ts';
import { reviseReceipt } from './receipt-revise.ts';
import { receiptLine, transactionalFakes, TRIP, tripLine } from './test-support/transactional-fakes.ts';

const lines = [receiptLine('basmati rice'), receiptLine('sponges'), receiptLine('chicken thighs'), receiptLine('milk')];

function reviewing(answer: Partial<SaidReceiptRevision> = {}) {
  const f = transactionalFakes([recipe('kale-soup', ['1 can chickpeas'], { title: 'Kale soup' })]);
  const milk = f.addItem('milk');
  f.addItem('Jasmine Rice', { status: 'out' });
  f.deps.receipts.saveTripList(TRIP, [tripLine(milk.id, 'milk'), tripLine(253, 'jasmine rice'), tripLine(251, 'chicken breasts')]);
  const id = f.addReceipt({ lines: lines.map((l, i) => (i === 3 ? { ...l, pantryItemId: milk.id } : l)) });
  const rows = reviewRows(lines, []);
  const said = (index: number, over: Partial<SaidRow> = {}): SaidRow => ({ ...rows[index], ...over });
  const reply: SaidReceiptRevision = { understood: true, note: 'Done.', lines: rows.map(r => said(r.index)), recipe: null, ...answer };
  f.deps.ai.reviseReceipt = vi.fn().mockResolvedValue(reply);
  return { f, id, rows, said };
}

describe('telling Claude what to change on a receipt', () => {
  it('fails plainly with no key, and refuses a receipt already saved', async () => {
    const { f, id, rows } = reviewing();
    f.deps.ai.available = () => false;
    await expect(reviseReceipt(f.deps, id, { said: 'x', rows })).rejects.toMatchObject({ status: 503, message: expect.stringMatching(/API key/) });
    f.deps.ai.available = () => true;
    f.deps.receipts.update(id, { status: 'applied' });
    await expect(reviseReceipt(f.deps, id, { said: 'x', rows })).rejects.toMatchObject({ status: 409 });
  });

  it('sends the rows as they stand, what can be chosen, and saves nothing', async () => {
    const { f, id, rows } = reviewing();
    const before = structuredClone(f.receipt(id));
    await reviseReceipt(f.deps, id, { said: 'the sponges, never track them', rows: rows.map(r => (r.index === 0 ? { ...r, name: 'basmati' } : r)) });
    const request = (f.deps.ai.reviseReceipt as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request.said).toBe('the sponges, never track them');
    expect(request.lines[0]).toMatchObject({ name: 'basmati', canNeverAdd: true, onList: false });
    expect(request.lines[3]).toMatchObject({ name: 'milk', canNeverAdd: false, onList: true });
    expect(request.notOnReceipt).toEqual([{ key: 'p253', name: 'jasmine rice' }, { key: 'p251', name: 'chicken breasts' }]);
    expect(request.recipes).toEqual([{ slug: 'kale-soup', title: 'Kale soup' }]);
    expect(f.receipt(id)).toEqual(before);
    expect(f.setting('never_add')).toBeNull();
  });

  it('gives back the rows as changed, held to what a tap could do', async () => {
    const { f, id, rows, said } = reviewing();
    const answer = [
      said(0, { name: 'jasmine rice', insteadOf: 'p253' }),
      said(1, { included: false, neverAdd: true }),
      said(2, { insteadOf: 'p251', always: true }),
      said(3, { included: false, neverAdd: true }),
      said(9, { included: false }),
    ];
    f.deps.ai.reviseReceipt = vi.fn().mockResolvedValue({ understood: true, note: 'Done.', lines: answer, recipe: null });
    const revised = await reviseReceipt(f.deps, id, { said: 'x', rows });
    expect(revised.rows.map(r => [r.name, r.included, r.neverAdd, r.insteadOf, r.always])).toEqual([
      ['Jasmine Rice', true, false, 'p253', false],
      ['sponges', false, true, null, false],
      ['chicken thighs', true, false, 'p251', true],
      ['milk', false, false, null, false],
    ]);
  });

  it('turns words about a recipe into a suggestion for it, and drops a recipe that isn’t in the book', async () => {
    const said = 'we always use black beans instead of chickpeas in the kale soup';
    const { f, id, rows } = reviewing({ understood: false, note: 'That’s about the kale soup.', recipe: { slug: 'kale-soup', said } });
    const revised = await reviseReceipt(f.deps, id, { said, rows });
    expect(revised.recipe).toEqual({ slug: 'kale-soup', title: 'Kale soup', said });
    expect(revised.rows).toEqual(rows);

    f.deps.ai.reviseReceipt = vi.fn().mockResolvedValue({ understood: false, note: 'Which soup?', lines: [], recipe: { slug: 'made-up', said } });
    await expect(reviseReceipt(f.deps, id, { said, rows })).rejects.toMatchObject({ status: 422, message: 'Which soup?' });
  });
});
