import { describe, expect, it } from 'vitest';
import { bringBack, changeRow, checkedRevision, choicesToSave, reviewRows, substitute, type ReviewFacts, type SaidRow } from './receipt-review.ts';

// 0 basmati (new), 1 parmesan (pantry), 2 magic eraser (new, never added before), 3 thighs (new), 4 milk (on the list)
const lines = [
  { name: 'basmati rice', pantryItemId: null, onList: false },
  { name: 'parmesan', pantryItemId: 62, onList: false },
  { name: 'Magic Eraser', pantryItemId: null, onList: false },
  { name: 'chicken thighs', pantryItemId: null, onList: false },
  { name: 'milk', pantryItemId: 55, onList: true },
];
const facts: ReviewFacts = { lines, pantryNames: ['parmesan', 'milk', 'Jasmine Rice', 'sponges'], notOnReceipt: ['p253', 'p251'] };
const start = () => reviewRows(lines, [2]);
const said = (index: number, over: Partial<SaidRow> = {}): SaidRow => {
  const row = start()[index];
  return { index, name: row.name, included: row.included, neverAdd: row.neverAdd, insteadOf: row.insteadOf, always: row.always, ...over };
};

describe('looking over a receipt', () => {
  it('starts with lines never added left out, and the rest kept', () => {
    const rows = start();
    expect(rows[2]).toMatchObject({ included: false, neverAdd: true, leftOut: true });
    expect(rows.filter(r => r.included)).toHaveLength(4);
  });

  it('brings a left-out line back for this receipt, and ticking it back in does the same', () => {
    expect(bringBack(start(), 2, facts)[2]).toMatchObject({ included: true, neverAdd: false, leftOut: false });
    expect(changeRow(start(), 2, { included: true }, facts)[2]).toMatchObject({ included: true, neverAdd: false });
  });

  it('only lets a line matched to nothing be never added', () => {
    expect(changeRow(start(), 0, { included: false, neverAdd: true }, facts)[0]).toMatchObject({ included: false, neverAdd: true });
    expect(changeRow(start(), 1, { included: false, neverAdd: true }, facts)[1].neverAdd).toBe(false);
    expect(changeRow(start(), 4, { included: false, neverAdd: true }, facts)[4].neverAdd).toBe(false);
    // Renamed to something in the pantry, it's a pantry line now.
    expect(changeRow(start(), 0, { name: 'jasmine rice', included: false, neverAdd: true }, facts)[0].neverAdd).toBe(false);
  });

  it('puts one line in for a list line, keeps it, and takes it back on "didn’t get it"', () => {
    const rows = substitute(changeRow(start(), 0, { included: false }, facts), 'p253', { index: 0, always: false }, facts);
    expect(rows[0]).toMatchObject({ insteadOf: 'p253', included: true, always: false });
    const moved = substitute(rows, 'p253', { index: 3, always: true }, facts);
    expect(moved[0].insteadOf).toBeNull();
    expect(moved[3]).toMatchObject({ insteadOf: 'p253', always: true });
    expect(substitute(moved, 'p253', null, facts).every(r => r.insteadOf === null && !r.always)).toBe(true);
  });

  it('drops a substitute whose line is unticked, or that isn’t missing from this receipt', () => {
    const rows = substitute(start(), 'p253', { index: 0, always: true }, facts);
    expect(changeRow(rows, 0, { included: false }, facts)[0]).toMatchObject({ insteadOf: null, always: false });
    expect(substitute(start(), 'p999', { index: 0, always: false }, facts)[0].insteadOf).toBeNull();
  });

  it('sends what was kept, what’s never added and what stood in', () => {
    let rows = changeRow(start(), 0, { name: 'basmati' }, facts);
    rows = substitute(rows, 'p251', { index: 3, always: true }, facts);
    expect(choicesToSave(rows)).toEqual({
      kept: [{ index: 0, name: 'basmati' }, { index: 1, name: 'parmesan' }, { index: 3, name: 'chicken thighs' }, { index: 4, name: 'milk' }],
      neverAdd: [{ index: 2, name: 'Magic Eraser' }],
      substitutes: [{ index: 3, listKey: 'p251', always: true }],
    });
  });
});

describe('Claude’s changes to a receipt under review', () => {
  it('takes names, ticks, never-adds and substitutes it was asked for', () => {
    const rows = checkedRevision([
      said(0, { insteadOf: 'p253' }),
      said(3, { name: 'Chicken thighs', insteadOf: 'p251', always: true }),
    ], start(), facts);
    expect(rows[0]).toMatchObject({ insteadOf: 'p253', always: false });
    expect(rows[3]).toMatchObject({ name: 'Chicken thighs', insteadOf: 'p251', always: true });
  });

  it('snaps a name to the pantry’s spelling', () => {
    expect(checkedRevision([said(0, { name: 'jasmine rice' })], start(), facts)[0].name).toBe('Jasmine Rice');
  });

  it('ignores lines that aren’t on screen and keeps the ones it left out', () => {
    const rows = checkedRevision([said(0, { included: false }), { ...said(0), index: 42, included: false }], start(), facts);
    expect(rows).toHaveLength(5);
    expect(rows[0].included).toBe(false);
    expect(rows.slice(1)).toEqual(start().slice(1));
  });

  it('won’t never-add a pantry or list line, or stand in for a list line that isn’t missing', () => {
    const rows = checkedRevision([
      said(1, { included: false, neverAdd: true }),
      said(4, { included: false, neverAdd: true }),
      said(0, { insteadOf: 'p30' }),
    ], start(), facts);
    expect(rows[1]).toMatchObject({ included: false, neverAdd: false });
    expect(rows[4]).toMatchObject({ included: false, neverAdd: false });
    expect(rows[0].insteadOf).toBeNull();
  });

  it('gives one list line one substitute, the first named', () => {
    const rows = checkedRevision([said(0, { insteadOf: 'p253' }), said(3, { insteadOf: 'p253' })], start(), facts);
    expect(rows.map(r => r.insteadOf)).toEqual(['p253', null, null, null, null]);
  });

  it('brings a left-out line back when asked to keep it, and keeps an empty or overlong name sensible', () => {
    const rows = checkedRevision([said(2, { included: true, neverAdd: true }), said(0, { name: '   ' }), said(3, { name: 'x'.repeat(500) })], start(), facts);
    expect(rows[2]).toMatchObject({ included: true, neverAdd: false, leftOut: false });
    expect(rows[0].name).toBe('basmati rice');
    expect(rows[3].name).toHaveLength(200);
  });
});
