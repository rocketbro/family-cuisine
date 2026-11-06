// Whether a line Claude wrote will mean what it should to the pantry. The parser takes almost
// anything, and what it can't place ends up in the item name, where it matches nothing:
// "a pinch of salt" is an item called "a pinch of salt". People's own lines aren't held to this.
import { parseIngredientLine } from './ingredient.ts';
import { parseUnit } from './units.ts';

const MOST_WORDS_IN_AN_ITEM = 6;
const LONGEST_GROUP_NAME = 60;
/** Amounts in words, which the grammar reads as the start of the item. */
const AMOUNT_WORDS = new Set([
  'a', 'an', 'some', 'half', 'quarter', 'couple', 'few', 'several', 'handful', 'dozen',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
]);

export function isGroupLine(line: string): boolean {
  return line.trim().endsWith(':');
}

/** True when the grammar reads this line the way it was meant: amount, unit, plain item, then the rest. */
export function readsAsIngredient(line: string): boolean {
  if (isGroupLine(line)) return line.trim().length <= LONGEST_GROUP_NAME;
  const parsed = parseIngredientLine(line);
  if (!parsed) return false;
  const name = parsed.item.toLowerCase();
  const words = name.split(/\s+/);
  if (/^[\d¼½¾⅓⅔⅛⅜⅝⅞]/.test(name)) return false;
  if (/[()]/.test(name) || /\.$/.test(name)) return false;
  if (/\b(or|to taste)\b/.test(name)) return false;
  if (words.length > MOST_WORDS_IN_AN_ITEM) return false;
  if (AMOUNT_WORDS.has(words[0]) && name !== 'half and half') return false;
  // "cloves" is a spice, but "cloves garlic" has lost its amount.
  return !(parsed.amount === null && words.length > 1 && parseUnit(words[0]));
}
