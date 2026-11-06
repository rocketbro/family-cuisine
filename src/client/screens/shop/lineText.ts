import type { ShoppingLine } from '../../../domain/shopping.ts';

/** "eggs (6)": the name, with how many for counted things. */
export function lineText(line: Pick<ShoppingLine, 'name' | 'quantity'>): string {
  return line.quantity ? `${line.name} (${line.quantity})` : line.name;
}

/** For the copied list, where the row beneath a line isn't there to say how many packages. */
export function copyText(line: Pick<ShoppingLine, 'name' | 'quantity' | 'packages'>): string {
  return line.packages > 1 ? `${lineText(line)}, buy ${line.packages}` : lineText(line);
}
