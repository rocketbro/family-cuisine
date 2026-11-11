// "Never add this" on a receipt: which lines an earlier choice leaves off, and remembering a new
// choice when the receipt is saved. Only a line matched to nothing, on the list or in the pantry,
// is ever left off or remembered, so a product the family does keep can't drop out this way.
import { isNeverAdded } from '../../domain/never-add.ts';
import { onTripList, type ReceiptLine, type TripLine } from '../../domain/receipts.ts';
import type { Deps } from './deps.ts';
import { neverAddList, rememberNeverAdd } from './never-add.ts';

const matchedToNothing = (deps: Deps, list: readonly TripLine[], line: ReceiptLine, name = line.name) =>
  line.pantryItemId === null && !onTripList(list, line) && !deps.pantry.findByName(name);

/** The indexes of lines left off because the family never adds them. */
export function leftOutLines(deps: Deps, lines: readonly ReceiptLine[], list: readonly TripLine[]): number[] {
  const never = neverAddList(deps);
  if (!never.length) return [];
  return lines.flatMap((line, index) => (matchedToNothing(deps, list, line) && isNeverAdded(line, never) ? [index] : []));
}

/** Remembers the lines someone chose never to add, under the name they gave, skipping any they also kept. */
export function keepNeverAdds(
  deps: Deps, lines: readonly ReceiptLine[], list: readonly TripLine[],
  chosen: readonly { index: number; name: string }[], kept: readonly { index: number }[],
): void {
  rememberNeverAdd(deps, chosen.flatMap(({ index, name }) => {
    const line = lines[index];
    if (!line || kept.some(k => k.index === index)) return [];
    const called = name.trim() || line.name;
    return matchedToNothing(deps, list, line, called) ? [{ printed: line.printed, name: called }] : [];
  }));
}
