// Pantry items that disagree with the pantry's own rules (use-by.ts, stand-ins, other names), each with one way to put it right.
import { nameKey, statusForCount, type PantryItem } from './pantry.ts';
import type { Fix, TidyInputs } from './tidy-types.ts';

const sameName = (a: string, b: string) => nameKey(a).join(' ') === nameKey(b).join(' ');

/** Other names with blanks, repeats and the item's own name taken out, in the order they were given. */
export function tidiedOtherNames(item: Pick<PantryItem, 'name' | 'alsoCalled'>): string[] {
  const kept: string[] = [];
  for (const name of item.alsoCalled.map(n => n.trim())) {
    if (name && !sameName(name, item.name) && !kept.some(k => sameName(k, name))) kept.push(name);
  }
  return kept;
}

export function untidyOtherNames(pantry: readonly PantryItem[]): Fix[] {
  return pantry.flatMap((item): Fix[] => {
    const tidied = tidiedOtherNames(item);
    if (tidied.length === item.alsoCalled.length && tidied.every((n, i) => n === item.alsoCalled[i])) return [];
    return [{ check: 'other-names', line: `Tidied the other names on ${item.name}`, step: { step: 'set_other_names', itemId: item.id, alsoCalled: tidied } }];
  });
}

/** "Just this time" names come off once an item is out, and an item that's out has no date. Writing the state again applies both rules. */
export function leftoverOnOutItems({ pantry, standInsForNow }: Pick<TidyInputs, 'pantry' | 'standInsForNow'>): Fix[] {
  return pantry.flatMap((item): Fix[] => {
    // A count above zero says it's in the house; that disagreement is `countsOutOfStep`'s.
    if (item.status !== 'out' || (item.count ?? 0) > 0) return [];
    const standing = standInsForNow.some(s => s.itemId === item.id);
    const state = { step: 'restate', itemId: item.id, count: item.count, status: 'out' } as const;
    return [
      ...(standing ? [{ check: 'stand-in-on-out-item', line: `Took a temporary stand-in name off ${item.name}, which is out`, step: state }] : []),
      ...(item.useBy ? [{ check: 'date-on-out-item', line: `Cleared the use-by date on ${item.name}, which is out`, step: state }] : []),
    ];
  });
}

/** A count drives the status so the two never disagree, and a count can't be below nothing. */
export function countsOutOfStep(pantry: readonly PantryItem[]): Fix[] {
  return pantry.flatMap((item): Fix[] => {
    if (item.count === null) return [];
    const count = Math.max(0, item.count);
    if (count === item.count && item.status === statusForCount(count)) return [];
    const line = count !== item.count ? `Set ${item.name} to none: its count was below zero` : `Made ${item.name} read ${statusForCount(count)}, as its count of ${count} says`;
    return [{ check: 'count-status', line, step: { step: 'restate', itemId: item.id, count, status: statusForCount(count) } }];
  });
}
