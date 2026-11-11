import { shopSections } from '../../../domain/shop-sections.ts';
import type { ShoppingLine } from '../../../domain/shopping.ts';

/** "eggs (6)": the name, with how many for counted things. */
export function lineText(line: Pick<ShoppingLine, 'name' | 'quantity'>): string {
  return line.quantity ? `${line.name} (${line.quantity})` : line.name;
}

/** For the copied list, where the row beneath a line isn't there to say how many packages. */
export function copyText(line: Pick<ShoppingLine, 'name' | 'quantity' | 'packages'>): string {
  return line.packages > 1 ? `${lineText(line)}, buy ${line.packages}` : lineText(line);
}

/** The whole list to paste elsewhere: the same sections in the same order as on screen. */
export function copyList(lines: readonly Pick<ShoppingLine, 'name' | 'quantity' | 'packages' | 'category'>[]): string {
  return shopSections(lines).map(({ category, lines: inSection }) => [category, ...inSection.map(copyText)].join('\n')).join('\n\n');
}

/** Why it's on the list, in a few words. */
export function lineReason(line: Pick<ShoppingLine, 'reason' | 'neededFor'>): string {
  if (line.reason === 'restock') return 'Restock';
  return line.reason === 'added' ? 'Added for this trip' : line.neededFor.join(', ');
}
