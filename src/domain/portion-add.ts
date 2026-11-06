// Adding stock: the total goes up, unlike a move (portion-move.ts). Said in the amount being added,
// and turned into an ordinary portion change, so dates and estimates work as they always do.
import type { ISODate } from './dates.ts';
import type { PantryItem } from './pantry.ts';
import { mergePortions, type Portion, type PortionChange, type Storage } from './portions.ts';
import type { Unit } from './units.ts';

/** A null amount is "some": there's a new form of it, and nobody's measured. */
export type StockToAdd = { storage: Storage; amount: number | null; unit: Unit | null };

type Stock = Pick<PantryItem, 'portions' | 'useBy' | 'useByEstimated'>;

/** The change that adds this: on top of the same form, or as a new one. */
export function additionAsChange(item: Stock, add: StockToAdd): PortionChange {
  const existing = item.portions.find(p => p.storage === add.storage);
  if (existing) {
    const unknown = existing.amount === null || add.amount === null;
    return { storage: add.storage, unit: existing.unit, amount: unknown ? existing.amount : Math.round((existing.amount! + add.amount!) * 100) / 100 };
  }
  // A plain item's own date is off a package; it goes with the first amount it's given, unless that's frozen.
  const keepsDate = !item.portions.length && item.useBy && !item.useByEstimated && add.storage !== 'frozen';
  return { storage: add.storage, amount: add.amount, unit: add.unit, ...(keepsDate ? { useBy: item.useBy } : {}) };
}

/** The portions after adding, as the server will work them out. */
export function portionsAfterAdding(item: Stock & Pick<PantryItem, 'lastsDays'>, add: StockToAdd, today: ISODate): Portion[] {
  return mergePortions(item.portions, [additionAsChange(item, add)], { current: item.lastsDays }, today);
}
