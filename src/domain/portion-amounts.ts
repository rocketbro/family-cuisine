// Comparing what a recipe asks for with what's on hand, across the ways an item is kept. Cans
// compare by count or, when sizes are known, by ounces, because recipes care about the ounces.
import type { Ingredient } from './ingredient.ts';
import { STORAGES, type Portion, type PortionChange } from './portions.ts';
import { convert, dimensionOf, type Unit } from './units.ts';

/** A pound of dried beans cooks up to about what four 15 oz cans hold. */
const CANS_PER_DRIED_LB = 4;
const CANNED_OZ_PER_DRIED_LB = CANS_PER_DRIED_LB * 15;
/** Cans come in near-enough sizes: 14.5 oz against a recipe's 15 isn't a shortage. */
const CAN_LEEWAY = 1.1;

type Need = { amount: number; unit: Unit | null; canOz: number | null; basis: 'canned' | 'dried' | null };

function needOf(ingredient: Ingredient, portions: readonly Portion[], factor: number): Need | null {
  if (ingredient.amount === null) return null;
  const amount = ingredient.amount * factor;
  const words = `${ingredient.item} ${ingredient.note ?? ''}`.toLowerCase();
  const canOz = ingredient.unit === 'can' ? Number(words.match(/(\d+(?:\.\d+)?)[\s-]*(?:oz|ounce)/)?.[1]) || null : null;
  if (canOz) return { amount: amount * canOz, unit: 'oz', canOz, basis: 'canned' };
  if (ingredient.unit === 'can' || /\bcan(s|ned)?\b/.test(words)) return { amount, unit: ingredient.unit, canOz: null, basis: 'canned' };
  // Beans kept both ways: a plain weight means dried, which is far more food per ounce than canned.
  const both = portions.some(p => p.storage === 'canned') && portions.some(p => p.storage === 'dried');
  return { amount, unit: ingredient.unit, canOz: null, basis: both || /\bdr(y|ied)\b/.test(words) ? 'dried' : null };
}

/** The portion's amount in what the recipe measures in, or null when they can't be compared. */
function amountIn(portion: Portion, need: Need): number | null {
  if (portion.amount === null) return null;
  const wanted = need.unit;
  if (!wanted || !portion.unit) return portion.unit === wanted ? portion.amount : null;
  const massWanted = dimensionOf(wanted) === 'mass';
  if (portion.unit === 'can') {
    if (wanted === 'can') return portion.amount;
    const size = portion.canOz ?? need.canOz;
    if (!massWanted || !size) return null;
    const ounces = portion.amount * size;
    return convert(need.basis === 'dried' ? (ounces / CANNED_OZ_PER_DRIED_LB) * 16 : ounces, 'oz', wanted);
  }
  if (dimensionOf(portion.unit) !== 'mass' || portion.storage !== 'dried' || need.basis !== 'canned') {
    if (portion.unit === wanted) return portion.amount;
    if (dimensionOf(wanted) === 'count' || dimensionOf(portion.unit) !== dimensionOf(wanted)) return null;
    return convert(portion.amount, portion.unit, wanted);
  }
  // Dried on hand, canned in the recipe.
  const pounds = convert(portion.amount, portion.unit, 'lb');
  if (wanted === 'can') return pounds * CANS_PER_DRIED_LB;
  return massWanted ? convert(pounds * CANNED_OZ_PER_DRIED_LB, 'oz', wanted) : null;
}

/** How much of what's on hand this needs: 0.5 is half, over 1 is not enough. Null when it can't be compared. */
export function shareNeeded(portions: readonly Portion[], ingredient: Ingredient, factor = 1): number | null {
  const need = portions.length ? needOf(ingredient, portions, factor) : null;
  if (!need) return null;
  let total = 0;
  for (const portion of portions) {
    const amount = amountIn(portion, need);
    if (amount === null) return null;
    total += amount;
  }
  if (total <= 0) return null;
  const share = need.amount / total;
  const hasCans = portions.some(p => p.unit === 'can');
  return hasCans && share > 1 && share <= CAN_LEEWAY ? 1 : share;
}

/** Which way gets used first: fresh before frozen, and the form the recipe asks for before the other. */
function orderForUse(need: Need): typeof STORAGES {
  if (need.basis === 'canned') return ['fresh', 'frozen', 'canned', 'dried'];
  if (need.basis === 'dried') return ['fresh', 'frozen', 'dried', 'canned'];
  return STORAGES;
}

/** What's left after cooking. Portions that can't be compared are left alone; an opened can is used up. */
export function portionsAfterCooking(portions: readonly Portion[], ingredient: Ingredient, factor = 1): PortionChange[] {
  const need = needOf(ingredient, portions, factor);
  if (!need) return [];
  let needed = need.amount;
  const changes: PortionChange[] = [];
  for (const portion of orderForUse(need).flatMap(s => portions.filter(p => p.storage === s))) {
    const amount = amountIn(portion, need);
    if (amount === null || amount <= 0 || needed <= 0) continue;
    const used = Math.min(amount, needed);
    needed -= used;
    const left = portion.amount! * (1 - used / amount);
    const rounded = portion.unit === 'can' ? Math.floor(left + (CAN_LEEWAY - 1)) : Math.round(left * 100) / 100;
    changes.push({ storage: portion.storage, amount: rounded, unit: portion.unit });
  }
  return changes;
}
