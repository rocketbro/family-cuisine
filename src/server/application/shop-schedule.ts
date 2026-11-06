// The household's shopping schedule as the use cases see it: the saved weekday (or the
// .env default) and any one-off trip moves.
import type { ISODate } from '../../domain/dates.ts';
import { regularFor, type ShopSchedule } from '../../domain/shop-schedule.ts';
import type { Deps } from './deps.ts';

const WEEKDAY_KEY = 'shop_weekday';

export function shopSchedule(deps: Deps): ShopSchedule {
  const saved = deps.household.setting(WEEKDAY_KEY);
  return { weekday: saved === null ? deps.settings.shopWeekday : Number(saved), moved: deps.household.tripMoves() };
}

/** Moving a trip to another day keeps it the same trip. */
export function tripOf(deps: Deps, shopDate: ISODate): ISODate {
  return regularFor(shopDate, shopSchedule(deps));
}

export function saveShopWeekday(deps: Deps, weekday: number): void {
  deps.household.saveSetting(WEEKDAY_KEY, String(weekday));
}
