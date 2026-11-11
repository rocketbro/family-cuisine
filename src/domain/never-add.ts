// Things off a receipt the family has said they never want in the pantry, like a cleaning pad.
// Later receipts leave them out in code, after the read: the model is never asked. A product is
// known by its printed words or its plain name, each compared whole once normalized, never as a
// part of something longer, so "magic eraser" can't take "magic eraser bath scrubber" with it.
import { nameKey } from './pantry.ts';

export type NeverAdd = { id: number; printed: string; name: string };

/** Lowercase, punctuation-free, singular words, so the same product prints the same way. */
export function productKey(words: string): string {
  return nameKey(words).join(' ');
}

/** A line the family never adds, by the same printed words or the same name. */
export function isNeverAdded(line: { printed: string; name: string }, list: readonly NeverAdd[]): boolean {
  const printed = productKey(line.printed);
  const name = productKey(line.name);
  return list.some(entry =>
    (printed !== '' && productKey(entry.printed) === printed) || (name !== '' && productKey(entry.name) === name));
}

/** The list with these products added once each. */
export function withNeverAdded(list: readonly NeverAdd[], lines: readonly { printed: string; name: string }[]): NeverAdd[] {
  const next = [...list];
  for (const line of lines) {
    const name = line.name.trim();
    if (!productKey(name) && !productKey(line.printed)) continue;
    if (isNeverAdded({ printed: line.printed, name }, next)) continue;
    next.push({ id: Math.max(0, ...next.map(e => e.id)) + 1, printed: line.printed.trim(), name: name || line.printed.trim() });
  }
  return next;
}
