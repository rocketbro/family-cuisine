// "We got something else instead" on a receipt: which kept line stands in for which list line the
// receipt doesn't otherwise have. Anything else the phone sends is dropped, one line per list line.
import type { TripDiff, TripLine } from '../../domain/receipts.ts';

export type Substitute = { index: number; listKey: string; always: boolean };

/** By the index of the line bought, the list line it was bought instead of. */
export function insteadOfLines(
  diff: Pick<TripDiff, 'skipped'>, substitutes: readonly Substitute[], kept: readonly { index: number }[],
): Map<number, { line: TripLine; always: boolean }> {
  const chosen = new Map<number, { line: TripLine; always: boolean }>();
  for (const { index, listKey, always } of substitutes) {
    const line = diff.skipped.find(l => l.key === listKey);
    const taken = [...chosen.values()].some(c => c.line.key === listKey);
    if (line && !taken && !chosen.has(index) && kept.some(k => k.index === index)) chosen.set(index, { line, always });
  }
  return chosen;
}
