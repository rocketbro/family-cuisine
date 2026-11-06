// The pantry list as it should show around a save. A failed tap goes back to what the server
// last confirmed for that item, not to what was on screen when it was tapped: with two quick
// taps that both fail, the second tap's "before" is the first tap's unsaved change.
import type { PantryItem } from '../../../domain/pantry.ts';

export function withChange(items: PantryItem[], id: number, change: Partial<PantryItem>): PantryItem[] {
  return items.map(i => (i.id === id ? { ...i, ...change } : i));
}

/** Puts the server's version of an item in place: after a save, or to undo one that failed. */
export function withSaved(items: PantryItem[], saved: PantryItem): PantryItem[] {
  return items.map(i => (i.id === saved.id ? saved : i));
}

export function without(items: PantryItem[], id: number): PantryItem[] {
  return items.filter(i => i.id !== id);
}

/** The server's latest word on an item: a save since the last load, else the load itself. */
export function lastConfirmed(id: number, saved: ReadonlyMap<number, PantryItem>, loaded: PantryItem[] | null): PantryItem | null {
  return saved.get(id) ?? loaded?.find(i => i.id === id) ?? null;
}
