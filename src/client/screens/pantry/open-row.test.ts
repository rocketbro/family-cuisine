import { describe, expect, it } from 'vitest';
import { keepOpenRow } from './open-row.ts';

describe('keepOpenRow', () => {
  const a = { id: 1 }, b = { id: 2 }, c = { id: 3 };
  it('changes nothing when no row is open', () => {
    expect(keepOpenRow([a, b], null, 0)).toEqual([a, b]);
  });
  it('keeps an item that has left the list where it was', () => {
    expect(keepOpenRow([a, c], b, 1)).toEqual([a, b, c]);
  });
  it('doesn’t let a changed date move the open row', () => {
    expect(keepOpenRow([b, a, c], a, 0)).toEqual([a, b, c]);
  });
  it('copes with a list that has shrunk', () => {
    expect(keepOpenRow([], b, 3)).toEqual([b]);
  });
});
