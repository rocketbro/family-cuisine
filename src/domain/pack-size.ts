// What one Walmart product comes as, read from its name: "Large White Eggs 18 Count", "Flour, 5 lb Bag".
import { convert, parseUnit, type Unit } from './units.ts';

/** How many it holds and how much it weighs or measures. Both null when the name doesn't say. */
export type PackSize = { count: number | null; measure: { amount: number; unit: Unit } | null };

const FLUID_OZ_ML = 29.5735;
const LARGER_VOLUMES: Record<string, number> = { gal: 3785.41, gallon: 3785.41, gallons: 3785.41, pint: 473.176, pints: 473.176, pt: 473.176 };

const AMOUNT = String.raw`(\d+(?:\.\d+)?)(?:\s*(?:-|to)\s*\d+(?:\.\d+)?)?\s*-?\s*`;
// "30g protein" is about what's inside, not the package.
const NOT_NUTRITION = String.raw`(?!\s*(?:of\s+)?(?:protein|fat|sugars?|fiber|carbs?)\b)`;
const MEASURE = new RegExp(`${AMOUNT}(fl\\.?\\s*oz|fluid\\s+ounces?|ounces?|oz|pounds?|lbs?|kilograms?|kg|grams?|g|milliliters?|ml|liters?|l|quarts?|qt|gallons?|gal|pints?|pt)\\b${NOT_NUTRITION}`, 'i');

function countIn(name: string): number | null {
  const counted = name.match(/(\d+)\s*-?\s*(?:count|ct|pack|pk|pieces?|pcs?)\b/) ?? name.match(/\bpack of (\d+)/);
  if (counted) return Number(counted[1]);
  if (/\bdozen\b/.test(name)) return 12;
  return /\beach\b/.test(name) ? 1 : null;
}

function measureIn(name: string): PackSize['measure'] {
  const found = name.match(MEASURE);
  if (found) {
    const amount = Number(found[1]);
    const word = found[2].replace(/\s+/g, ' ');
    if (/^fl|^fluid/.test(word)) return { amount: amount * FLUID_OZ_ML, unit: 'ml' };
    if (LARGER_VOLUMES[word]) return { amount: amount * LARGER_VOLUMES[word], unit: 'ml' };
    const unit = parseUnit(word);
    return unit ? { amount, unit } : null;
  }
  // Sold as just "Gallon" or "Quart", with no number.
  if (/\bhalf gallon\b/.test(name)) return { amount: LARGER_VOLUMES.gallon / 2, unit: 'ml' };
  if (/\bgallon\b/.test(name)) return { amount: LARGER_VOLUMES.gallon, unit: 'ml' };
  if (/\bquart\b/.test(name)) return { amount: convert(1, 'quart', 'ml'), unit: 'ml' };
  return null;
}

export function parsePackSize(productName: string): PackSize {
  const name = productName.toLowerCase();
  return { count: countIn(name), measure: measureIn(name) };
}
