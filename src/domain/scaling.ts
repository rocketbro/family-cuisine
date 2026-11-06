// The recipe multiplier: ½×, 1×, 2×, 3× and anything between.
import type { Ingredient } from './ingredient.ts';
import { singular } from './pantry.ts';
import { formatAmount } from './quantity.ts';
import { tidyAmount, unitLabel } from './units.ts';

export const MULTIPLIERS = [0.5, 1, 1.5, 2, 3] as const;

/**
 * The most batches of a recipe the model may choose. More is taken as a mistake, and the household's
 * usual batch is used instead. A person choosing by hand can go higher.
 */
const MOST_MODEL_BATCHES = 4;

export function isPlausibleModelBatch(multiplier: number): boolean {
  return multiplier > 0 && multiplier <= MOST_MODEL_BATCHES;
}

export function multiplierLabel(m: number): string {
  return `${formatAmount(m)}×`;
}

export type ScaledIngredient = { amountText: string | null; item: string; note: string | null; optional: boolean };

/** Words that end in s without being plural. */
const NOT_PLURAL = /(?:ss|us|is|as)$/;
/** Things sold and cooked by the each, where "2 onions" is certainly right. Anything else keeps its wording. */
const COUNTED_PLURALS: Record<string, string> = {
  onion: 'onions', pepper: 'peppers', tomato: 'tomatoes', potato: 'potatoes', carrot: 'carrots', egg: 'eggs', lemon: 'lemons', lime: 'limes',
  apple: 'apples', banana: 'bananas', avocado: 'avocados', tortilla: 'tortillas', leaf: 'leaves', loaf: 'loaves', bratwurst: 'bratwursts',
};

/** "1 red bell peppers" reads "1 red bell pepper", and "2 yellow onion" reads "2 yellow onions". */
export function countedName(name: string, count: number): string {
  const words = name.split(' ');
  const last = words[words.length - 1];
  const lower = last.toLowerCase();
  if (count <= 1) words[words.length - 1] = NOT_PLURAL.test(lower) ? last : singular(lower);
  else words[words.length - 1] = COUNTED_PLURALS[singular(lower)] ?? last;
  return words.join(' ');
}

export function scaleIngredient(ingredient: Ingredient, factor: number): ScaledIngredient {
  const base = { item: ingredient.item, note: ingredient.note, optional: ingredient.optional };
  if (ingredient.amount === null) return { ...base, amountText: null };

  let amount = ingredient.amount * factor;
  let max = ingredient.amountMax !== null ? ingredient.amountMax * factor : null;
  let unit = ingredient.unit;
  if (unit) {
    const tidy = tidyAmount(amount, unit);
    if (max !== null && tidy.unit !== unit) max = tidyAmount(max, unit).amount;
    amount = tidy.amount;
    unit = tidy.unit;
  }
  const item = unit ? ingredient.item : countedName(ingredient.item, max ?? amount);
  const number = max !== null ? `${formatAmount(amount)}–${formatAmount(max)}` : formatAmount(amount);
  const amountText = unit ? `${number} ${unitLabel(unit, max ?? amount)}` : number;
  return { ...base, item, amountText };
}
