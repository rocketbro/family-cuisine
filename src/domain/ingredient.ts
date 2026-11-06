// One ingredient line, written the way a person writes it and readable by the pantry:
//   - 1 1/2 cups rolled oats, plus more for the top
//   - 2 large eggs
//   - salt, to taste
//   - fresh parsley, chopped (optional)
// Grammar: [amount[-amount]] [unit] item[, note] [(optional)]. The item is what gets matched
// against the pantry, so imports name it plainly ("rolled oats", not "oats (rolled)").
import { AMOUNT_PATTERN, parseAmount } from './quantity.ts';
import { parseUnit, unitLabel, type Unit } from './units.ts';

export type Ingredient = {
  amount: number | null;
  amountMax: number | null;
  unit: Unit | null;
  item: string;
  note: string | null;
  optional: boolean;
  group: string | null;
};

/** "(optional)", or "(optional, any kind)" with something to say about it. */
const OPTIONAL = /\s*\(optional(?:[,;:]\s*([^)]*))?\)\s*$/i;

export function parseIngredientLine(line: string, group: string | null = null): Ingredient | null {
  let text = line.replace(/^\s*[-*]\s+/, '').trim();
  if (!text) return null;
  const optionalMatch = text.match(OPTIONAL);
  const optional = optionalMatch !== null;
  const optionalNote = optionalMatch?.[1]?.trim() || null;
  text = text.replace(OPTIONAL, '');

  const amountMatch = text.match(AMOUNT_PATTERN);
  const amountText = amountMatch?.[1]?.trim() ?? '';
  const amount = amountText ? parseAmount(amountText) : null;
  const amountMax = amountMatch?.[2] ? parseAmount(amountMatch[2]) : null;
  if (amount !== null && amountMatch) text = text.slice(amountMatch[0].length).trim();

  let unit: Unit | null = null;
  const firstWord = text.split(/\s+/)[0] ?? '';
  if (amount !== null && parseUnit(firstWord)) {
    unit = parseUnit(firstWord);
    text = text.slice(firstWord.length).trim().replace(/^of\s+/i, '');
  }

  const comma = text.indexOf(',');
  const item = (comma >= 0 ? text.slice(0, comma) : text).trim();
  const written = comma >= 0 ? text.slice(comma + 1).trim() || null : null;
  const note = [written, optionalNote].filter(Boolean).join(', ') || null;
  if (!item) return null;
  return { amount, amountMax, unit, item, note, optional, group };
}

/** Serializes back to the canonical line, so imports and hand edits read the same. */
export function formatIngredientLine(ingredient: Ingredient): string {
  const parts: string[] = [];
  if (ingredient.amount !== null) {
    parts.push(ingredient.amountMax !== null ? `${trimNumber(ingredient.amount)}-${trimNumber(ingredient.amountMax)}` : trimNumber(ingredient.amount));
  }
  if (ingredient.unit) parts.push(unitLabel(ingredient.unit, ingredient.amountMax ?? ingredient.amount ?? 1));
  parts.push(ingredient.item);
  let line = parts.join(' ');
  if (ingredient.note) line += `, ${ingredient.note}`;
  if (ingredient.optional) line += ' (optional)';
  return `- ${line}`;
}

function trimNumber(n: number): string {
  const thirds = Math.round(n * 3);
  if (Math.abs(n * 3 - thirds) < 0.01 && thirds % 3 !== 0) {
    const whole = Math.floor(thirds / 3);
    const rest = `${thirds % 3}/3`;
    return whole > 0 ? `${whole} ${rest}` : rest;
  }
  const quarters = Math.round(n * 4);
  if (Math.abs(n * 4 - quarters) < 0.01 && quarters % 4 !== 0) {
    const whole = Math.floor(quarters / 4);
    const rest = quarters % 4 === 2 ? '1/2' : `${quarters % 4}/4`;
    return whole > 0 ? `${whole} ${rest}` : rest;
  }
  return String(Math.round(n * 1000) / 1000);
}
