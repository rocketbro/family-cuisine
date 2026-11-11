// What someone has decided about each line of a receipt they're looking over, before Save. Taps
// and Claude's answers both land here, and `settleRows` keeps every decision one that can be saved:
// only a line that's nothing on the list or in the pantry can be never added, and a substitute has
// to be a line they're keeping, standing in for a list line this receipt doesn't have.

export type ReceiptRow = {
  index: number;
  name: string;
  included: boolean;
  /** Leave this product off every receipt from now on. */
  neverAdd: boolean;
  /** Left off by an earlier "never add", until someone brings it back for this receipt. */
  leftOut: boolean;
  /** The key of the list line this was bought instead of. */
  insteadOf: string | null;
  /** Fine instead of it from now on, not only this time. */
  always: boolean;
};

/** What the receipt and the pantry say, which taps can't change. Lines are by index. */
export type ReviewFacts = {
  lines: readonly { pantryItemId: number | null; onList: boolean }[];
  pantryNames: readonly string[];
  /** Keys of the list lines no line on this receipt matched. */
  notOnReceipt: readonly string[];
};

export function reviewRows(lines: readonly { name: string }[], leftOut: readonly number[]): ReceiptRow[] {
  return lines.map((line, index) => {
    const off = leftOut.includes(index);
    return { index, name: line.name, included: !off, neverAdd: off, leftOut: off, insteadOf: null, always: false };
  });
}

/** The pantry's own spelling of a name typed or said any which way, or null. */
export function pantryNamed(name: string, pantryNames: readonly string[]): string | null {
  const wanted = name.trim().toLowerCase();
  return pantryNames.find(p => p.toLowerCase() === wanted) ?? null;
}

/** Only something matched to nothing, on the list or in the pantry, can be never added. */
export function canNeverAdd(row: ReceiptRow, facts: ReviewFacts): boolean {
  const line = facts.lines[row.index];
  return Boolean(line) && line.pantryItemId === null && !line.onList && row.insteadOf === null && pantryNamed(row.name, facts.pantryNames) === null;
}

export function settleRows(rows: readonly ReceiptRow[], facts: ReviewFacts): ReceiptRow[] {
  const taken = new Set<string>();
  return rows.map(row => {
    const insteadOf = row.included && row.insteadOf !== null && facts.notOnReceipt.includes(row.insteadOf) && !taken.has(row.insteadOf) ? row.insteadOf : null;
    if (insteadOf) taken.add(insteadOf);
    const neverAdd = row.neverAdd && canNeverAdd({ ...row, insteadOf }, facts);
    return {
      ...row,
      included: neverAdd ? false : row.included,
      neverAdd,
      leftOut: row.leftOut && neverAdd,
      insteadOf: neverAdd ? null : insteadOf,
      always: insteadOf !== null && !neverAdd && row.always,
    };
  });
}

/** Ticking a line back in also takes back "never add". */
export function changeRow(rows: readonly ReceiptRow[], index: number, change: Partial<Omit<ReceiptRow, 'index'>>, facts: ReviewFacts): ReceiptRow[] {
  const keeping = change.included === true && change.neverAdd === undefined ? { neverAdd: false, leftOut: false } : {};
  return settleRows(rows.map(row => (row.index === index ? { ...row, ...change, ...keeping } : row)), facts);
}

/** Brings a line left off by "never add" back, for this receipt only. */
export function bringBack(rows: readonly ReceiptRow[], index: number, facts: ReviewFacts): ReceiptRow[] {
  return changeRow(rows, index, { included: true, neverAdd: false, leftOut: false }, facts);
}

/** What stands in for a list line: one line of the receipt, or none ("didn't get it"). */
export function substitute(
  rows: readonly ReceiptRow[], listKey: string, choice: { index: number; always: boolean } | null, facts: ReviewFacts,
): ReceiptRow[] {
  const cleared = rows.map(row => (row.insteadOf === listKey ? { ...row, insteadOf: null, always: false } : row));
  if (!choice) return settleRows(cleared, facts);
  return changeRow(cleared, choice.index, { insteadOf: listKey, always: choice.always, included: true, neverAdd: false, leftOut: false }, facts);
}

/** A row as Claude gave it back. Anything else it said is ignored. */
export type SaidRow = { index: number; name: string; included: boolean; neverAdd: boolean; insteadOf: string | null; always: boolean };

const LONGEST_NAME = 200;

/**
 * Claude's answer, held to the rows on screen: unknown lines are dropped, missing ones stay as they
 * were, names snap to the pantry's spelling, and every decision has to be one a tap could make.
 */
export function checkedRevision(said: readonly SaidRow[], before: readonly ReceiptRow[], facts: ReviewFacts): ReceiptRow[] {
  return settleRows(before.map(row => {
    const answer = said.find(s => s.index === row.index);
    if (!answer) return row;
    const typed = answer.name.trim().slice(0, LONGEST_NAME);
    const name = typed ? pantryNamed(typed, facts.pantryNames) ?? typed : row.name;
    const broughtBack = row.leftOut && answer.included;
    return {
      ...row, name, included: answer.included, neverAdd: answer.neverAdd && !broughtBack, leftOut: row.leftOut && !broughtBack,
      insteadOf: answer.insteadOf, always: answer.always,
    };
  }), facts);
}

export type ReceiptChoices = {
  kept: { index: number; name: string }[];
  neverAdd: { index: number; name: string }[];
  substitutes: { index: number; listKey: string; always: boolean }[];
};

/** What Save sends. */
export function choicesToSave(rows: readonly ReceiptRow[]): ReceiptChoices {
  return {
    kept: rows.filter(r => r.included).map(r => ({ index: r.index, name: r.name })),
    neverAdd: rows.filter(r => r.neverAdd).map(r => ({ index: r.index, name: r.name })),
    substitutes: rows.flatMap(r => (r.insteadOf ? [{ index: r.index, listKey: r.insteadOf, always: r.always }] : [])),
  };
}
