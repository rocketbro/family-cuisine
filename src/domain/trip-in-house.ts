// A trip nobody recorded. The groceries are most likely in the kitchen even though no one tapped Put
// away or added a receipt, so until someone does, what was on that trip's list counts as in the house.
// This is only for deciding what can stay on the plan and what can go on it: the pantry itself doesn't change.
import type { ISODate } from './dates.ts';
import { findPantryItem, type PantryItem } from './pantry.ts';
import { restocked, type Portion } from './portions.ts';
import { COUNT_ASSUMED_BOUGHT, type Receipt, type TripLine } from './receipts.ts';
import { tripWindow, type ShopSchedule } from './shop-schedule.ts';

/**
 * The latest trip that has happened. Null on a trip's own day: that trip hasn't happened yet, and the
 * one before it ends there. A trip moved to another day is no longer in the schedule, so it counts from its new day.
 */
export function latestTripGone(today: ISODate, schedule: ShopSchedule): ISODate | null {
  const { start } = tripWindow(today, schedule);
  return start < today ? start : null;
}

/** Someone put things away for the trip, off the list or for stocking up, or applied a receipt to it. From then on the pantry is the truth. */
export function tripRecorded(
  trip: ISODate, list: readonly TripLine[], stockPutAway: Readonly<Record<number, number>>, receipts: readonly Pick<Receipt, 'shopDate' | 'status'>[],
): boolean {
  return list.some(line => line.checkedOff) || Object.keys(stockPutAway).length > 0 || receipts.some(r => r.shopDate === trip && r.status === 'applied');
}

/** The pantry as if the list had come home. A line with no item yet (a recipe's ingredient nobody has stocked) gets a stand-in. */
export function pantryWithTripList(pantry: readonly PantryItem[], lines: readonly TripLine[]): PantryItem[] {
  let house = [...pantry];
  lines.forEach((line, index) => {
    const item = (line.pantryItemId !== null ? house.find(p => p.id === line.pantryItemId) : null) ?? findPantryItem(line.name, house);
    house = item
      ? house.map(p => (p.id === item.id ? afterBuying(p, line) : p))
      : [...house, standIn(line.name, -(index + 1))];
  });
  return house;
}

/** The same as putting it away: a count goes up by what the list wanted, and the amount of what's bought fresh stops being known. */
function afterBuying(item: PantryItem, line: TripLine): PantryItem {
  if (item.portions.length) return { ...item, status: 'have', portions: portionsRestocked(item.portions) };
  if (item.count !== null) return { ...item, status: 'have', count: item.count + (line.quantity ?? COUNT_ASSUMED_BOUGHT) };
  return { ...item, status: 'have' };
}

function portionsRestocked(portions: readonly Portion[]): Portion[] {
  const change = restocked(portions);
  if (!portions.some(p => p.storage === change.storage)) {
    return [...portions, { storage: change.storage, amount: null, unit: change.unit, canOz: null, useBy: null, useByEstimated: false }];
  }
  return portions.map(p => (p.storage === change.storage ? { ...p, amount: null, unit: change.unit } : p));
}

function standIn(name: string, id: number): PantryItem {
  return {
    id, name, category: 'Pantry', status: 'have', count: null, staple: false, store: 'any', walmartItemId: null, packSize: null, stockUp: null,
    minPackages: 1, occasional: false, useBy: null, useByEstimated: false, lastsDays: null, portions: [], alsoCalled: [],
  };
}
