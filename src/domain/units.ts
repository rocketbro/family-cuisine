// Units a recipe can measure in, the words people actually write for them, and the
// conversions that let a scaled amount read naturally ("6 tsp" becomes "2 tbsp").

export type Dimension = 'mass' | 'volume' | 'count';

type UnitDef = { dimension: Dimension; toBase: number; singular: string; plural: string };

const UNITS = {
  g: { dimension: 'mass', toBase: 1, singular: 'g', plural: 'g' },
  kg: { dimension: 'mass', toBase: 1000, singular: 'kg', plural: 'kg' },
  oz: { dimension: 'mass', toBase: 28.3495, singular: 'oz', plural: 'oz' },
  lb: { dimension: 'mass', toBase: 453.592, singular: 'lb', plural: 'lb' },
  ml: { dimension: 'volume', toBase: 1, singular: 'ml', plural: 'ml' },
  l: { dimension: 'volume', toBase: 1000, singular: 'l', plural: 'l' },
  tsp: { dimension: 'volume', toBase: 4.92892, singular: 'tsp', plural: 'tsp' },
  tbsp: { dimension: 'volume', toBase: 14.7868, singular: 'tbsp', plural: 'tbsp' },
  cup: { dimension: 'volume', toBase: 236.588, singular: 'cup', plural: 'cups' },
  quart: { dimension: 'volume', toBase: 946.353, singular: 'quart', plural: 'quarts' },
  can: { dimension: 'count', toBase: 1, singular: 'can', plural: 'cans' },
  clove: { dimension: 'count', toBase: 1, singular: 'clove', plural: 'cloves' },
  slice: { dimension: 'count', toBase: 1, singular: 'slice', plural: 'slices' },
  pinch: { dimension: 'count', toBase: 1, singular: 'pinch', plural: 'pinches' },
  package: { dimension: 'count', toBase: 1, singular: 'package', plural: 'packages' },
} as const satisfies Record<string, UnitDef>;

export type Unit = keyof typeof UNITS;

const ALIASES: Record<string, Unit> = {
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml',
  l: 'l', liter: 'l', liters: 'l',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup',
  quart: 'quart', quarts: 'quart', qt: 'quart',
  can: 'can', cans: 'can',
  clove: 'clove', cloves: 'clove',
  slice: 'slice', slices: 'slice',
  pinch: 'pinch', pinches: 'pinch',
  package: 'package', packages: 'package', pkg: 'package',
};

export function parseUnit(word: string): Unit | null {
  return ALIASES[word.toLowerCase().replace(/\.$/, '')] ?? null;
}

export function unitLabel(unit: Unit, amount: number): string {
  const def = UNITS[unit];
  return amount > 1 ? def.plural : def.singular;
}

export function dimensionOf(unit: Unit): Dimension {
  return UNITS[unit].dimension;
}

export function convert(amount: number, from: Unit, to: Unit): number {
  if (UNITS[from].dimension !== UNITS[to].dimension) throw new Error(`cannot convert ${from} to ${to}`);
  return from === to ? amount : (amount * UNITS[from].toBase) / UNITS[to].toBase;
}

// Upgrade ladders for US kitchen volumes and for mass. Scaling up should read the way a
// cook would write it; scaling down never downgrades (half a cup stays "½ cup").
const VOLUME_LADDER: Unit[] = ['tsp', 'tbsp', 'cup'];
const UPGRADE_AT: Partial<Record<Unit, number>> = { tsp: 3, tbsp: 4 };

export function tidyAmount(amount: number, unit: Unit): { amount: number; unit: Unit } {
  let current = { amount, unit };
  for (;;) {
    const threshold = UPGRADE_AT[current.unit];
    const index = VOLUME_LADDER.indexOf(current.unit);
    if (threshold === undefined || index < 0 || current.amount < threshold) break;
    const next = VOLUME_LADDER[index + 1];
    const converted = convert(current.amount, current.unit, next);
    if (!isFriendly(converted)) break;
    current = { amount: converted, unit: next };
  }
  if (current.unit === 'g' && current.amount >= 1000) return { amount: current.amount / 1000, unit: 'kg' };
  return current;
}

/** Whether an amount lands on a fraction a measuring set can hold (quarters and thirds). */
function isFriendly(amount: number): boolean {
  const close = (x: number) => Math.abs(amount * x - Math.round(amount * x)) < 0.02;
  return close(4) || close(3);
}
