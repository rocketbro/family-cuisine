// Someone has the list in front of them, so what it says now is what the trip is working from. The
// list itself is worked out fresh for every read (`shoppingWeek`); this only keeps the record of it.
import type { ISODate } from '../../domain/dates.ts';
import type { Deps } from './deps.ts';
import { keepTripList } from './receipts.ts';
import { keepStockPlan, shoppingWeek } from './shopping.ts';
import { learnWalmartPacks } from './walmart-packs.ts';

/** Saves the list and the stock plan as they stand, and starts reading any unread package sizes. */
export function noteListOpened(deps: Deps, today: ISODate): void {
  const week = shoppingWeek(deps, today);
  keepTripList(deps, week.shopDate, week.lines);
  keepStockPlan(deps, week);
  void learnWalmartPacks(deps);
}
