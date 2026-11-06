// What the stock-up picker shows for a search: pantry items, by name or anything they're also called.
import type { PantryItem } from '../../../../domain/pantry.ts';

export function matchingItems<T extends Pick<PantryItem, 'name' | 'alsoCalled'>>(items: readonly T[], query: string): T[] {
  const wanted = query.trim().toLowerCase();
  return items
    .filter(item => !wanted || item.name.toLowerCase().includes(wanted) || item.alsoCalled.some(name => name.toLowerCase().includes(wanted)))
    .sort((a, b) => a.name.localeCompare(b.name));
}
