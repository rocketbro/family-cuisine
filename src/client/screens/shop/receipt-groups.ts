// How the review sorts a receipt's lines, and what it knows about each that taps can't change.
import type { ReceiptRow, ReviewFacts } from '../../../domain/receipt-review.ts';
import type { ReceiptView } from '../../../shared/api-types.ts';

export function reviewFacts(receipt: ReceiptView, pantryNames: string[]): ReviewFacts {
  const planned = new Set(receipt.diff.bought.flatMap(b => b.matched.map(m => m.printed)));
  return {
    lines: receipt.lines.map(line => ({ pantryItemId: line.pantryItemId, onList: planned.has(line.printed) })),
    pantryNames,
    notOnReceipt: receipt.diff.skipped.map(l => l.key),
  };
}

/** Lines that could have come instead of something on the list: anything not bought for the list itself, new things first. */
export function insteadCandidates(receipt: ReceiptView, rows: readonly ReceiptRow[], facts: ReviewFacts): ReceiptRow[] {
  const isNew = (row: ReceiptRow) => receipt.lines[row.index].pantryItemId === null;
  return rows
    .filter(row => !row.leftOut && !facts.lines[row.index].onList)
    .sort((a, b) => Number(isNew(b)) - Number(isNew(a)));
}

/** Lines left out by "never add" aren't in any group; they have their own quiet line. */
export function receiptGroups(receipt: ReceiptView, rows: readonly ReceiptRow[], facts: ReviewFacts): [string, ReceiptRow[]][] {
  const shown = rows.filter(row => !row.leftOut);
  const line = (row: ReceiptRow) => receipt.lines[row.index];
  const listed = (row: ReceiptRow) => facts.lines[row.index].onList;
  return [
    ['Check these', shown.filter(r => line(r).unsure)],
    ['From your list', shown.filter(r => !line(r).unsure && listed(r))],
    ['Not on the list, already in the pantry', shown.filter(r => !line(r).unsure && !listed(r) && line(r).pantryItemId !== null)],
    ['New to the pantry', shown.filter(r => !line(r).unsure && !listed(r) && line(r).pantryItemId === null)],
  ];
}
