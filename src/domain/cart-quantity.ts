// How many packages cover what the week's meals need.
import type { PackSize } from './pack-size.ts';
import { convert, dimensionOf, type Unit } from './units.ts';

export type CartNeed = { amount: number; unit: Unit | null };

const MOST_IN_CART = 50;
/** Rounding noise shouldn't buy a whole extra package. */
const ROUNDING = 1e-6;

/** Grams or milliliters. A recipe's cups against a bag's pounds count 1 ml as 1 g, which errs toward enough for nearly everything in a kitchen. */
function baseAmount(amount: number, unit: Unit): number {
  return convert(amount, unit, dimensionOf(unit) === 'mass' ? 'g' : 'ml');
}

/**
 * Packages for these needs, less what's already counted on hand. Null when no need can be compared
 * with the package (six onions against a 3 lb bag), so the caller keeps to the usual quantity.
 */
export function packagesNeeded(needs: readonly CartNeed[], pack: PackSize | null, onHand = 0, share = 1): number | null {
  let packages = 0;
  let loose = 0;
  let compared = false;
  for (const { amount, unit } of needs) {
    if (unit === null) {
      if (pack?.count) { loose += amount; compared = true; }
    } else if (unit === 'can' || unit === 'package') {
      packages += amount / (pack?.count ?? 1);
      compared = true;
    } else if (dimensionOf(unit) !== 'count' && pack?.measure) {
      packages += baseAmount(amount, unit) / baseAmount(pack.measure.amount, pack.measure.unit);
      compared = true;
    }
  }
  if (!compared) return null;
  if (pack?.count) packages += Math.max(0, loose - onHand) / pack.count;
  return Math.min(MOST_IN_CART, Math.ceil(packages * share - ROUNDING));
}
