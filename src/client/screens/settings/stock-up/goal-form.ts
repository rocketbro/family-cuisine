// Turning the goal form's controls into a goal and a package size, and back.
import type { PackSize } from '../../../../domain/pack-size.ts';
import type { PantryItem } from '../../../../domain/pantry.ts';
import { dimensionOf, parseUnit, type Unit } from '../../../../domain/units.ts';
import type { Storage } from '../../../../domain/portions.ts';

/** What a select holds for "just count them": a null unit. */
export const COUNT = 'count';
export type UnitChoice = Unit | typeof COUNT;

export const KEPT: { value: Storage; label: string }[] = [
  { value: 'frozen', label: 'Frozen' }, { value: 'canned', label: 'Canned' }, { value: 'dried', label: 'Dried' }, { value: 'fresh', label: 'Fresh' },
];

const GOAL_UNITS: { value: UnitChoice; label: string }[] = [
  { value: 'lb', label: 'lb' }, { value: 'oz', label: 'oz' }, { value: 'can', label: 'cans' }, { value: 'package', label: 'packages' }, { value: COUNT, label: 'count' },
];
const PACK_UNITS: { value: UnitChoice; label: string }[] = [
  { value: 'lb', label: 'lb' }, { value: 'oz', label: 'oz' }, { value: COUNT, label: 'count' },
];

/** The usual choices, plus whatever's already saved if it's something else. */
function choicesWith(choices: { value: UnitChoice; label: string }[], current: UnitChoice) {
  return choices.some(c => c.value === current) ? choices : [...choices, { value: current, label: current }];
}
export const goalUnits = (current: UnitChoice) => choicesWith(GOAL_UNITS, current);
export const packUnits = (current: UnitChoice) => choicesWith(PACK_UNITS, current);

export const unitOf = (choice: UnitChoice): Unit | null => (choice === COUNT ? null : choice);
export const choiceOf = (unit: Unit | null): UnitChoice => unit ?? COUNT;
export const asChoice = (value: string): UnitChoice => (value === COUNT ? COUNT : parseUnit(value) ?? COUNT);

/** A positive number, or null for anything else. */
export function amountFrom(text: string): number | null {
  const amount = Number(text.trim());
  return text.trim() !== '' && Number.isFinite(amount) && amount > 0 ? amount : null;
}

const STARTING_UNIT: Partial<Record<Storage, Unit>> = { canned: 'can' };

/** A new goal starts from what's already kept that way, so its progress can be compared. */
export function startingUnit(item: Pick<PantryItem, 'portions'>, storage: Storage): UnitChoice {
  const portion = item.portions.find(p => p.storage === storage);
  return portion?.amount != null ? choiceOf(portion.unit) : STARTING_UNIT[storage] ?? 'lb';
}

export function startingStorage(item: Pick<PantryItem, 'portions'>): Storage {
  return item.portions.find(p => p.amount !== null)?.storage ?? 'frozen';
}

/** The package controls show the measure when there is one, since that's what most goals count in. */
export function packFields(pack: PackSize | null): { amount: string; unit: UnitChoice } | null {
  if (pack?.measure) return { amount: String(Math.round(pack.measure.amount * 100) / 100), unit: pack.measure.unit };
  return pack?.count ? { amount: String(pack.count), unit: COUNT } : null;
}

/** A goal in pounds or ounces has packages by weight. Anything counted has packages by count. */
export function packUnitFor(goalUnit: UnitChoice): UnitChoice {
  return goalUnit === COUNT || dimensionOf(goalUnit) === 'count' ? COUNT : goalUnit;
}

export function packFrom(amount: number, unit: UnitChoice): PackSize {
  return unit === COUNT ? { count: amount, measure: null } : { count: null, measure: { amount, unit } };
}
