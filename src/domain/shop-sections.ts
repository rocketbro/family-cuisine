// The list in the order you walk the store: produce at the door, the shelves in the middle, then
// what shouldn't sit in the basket for long, and whatever has no aisle at the end.
import type { ShoppingLine } from './shopping.ts';

export const OTHER_SECTION = 'Other';
export const STORE_WALK = ['Produce', 'Bread', 'Pantry', 'Baking', 'Spices', 'Meat', 'Dairy & eggs', 'Frozen', OTHER_SECTION];

export type ShopSection<T> = { category: string; lines: T[] };

const sectionOf = (category: string) => (STORE_WALK.includes(category) ? category : OTHER_SECTION);

/** By section along the walk, then by name. */
export function inWalkingOrder<T extends Pick<ShoppingLine, 'category' | 'name'>>(lines: readonly T[]): T[] {
  const rank = (line: T) => STORE_WALK.indexOf(sectionOf(line.category));
  return [...lines].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** Only the sections with something in them. */
export function shopSections<T extends Pick<ShoppingLine, 'category' | 'name'>>(lines: readonly T[]): ShopSection<T>[] {
  const sections: ShopSection<T>[] = [];
  for (const line of inWalkingOrder(lines)) {
    const category = sectionOf(line.category);
    const last = sections.at(-1);
    if (last?.category === category) last.lines.push(line);
    else sections.push({ category, lines: [line] });
  }
  return sections;
}
