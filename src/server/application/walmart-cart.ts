// What the app has already sent to the Walmart cart for a trip. Walmart's link only adds and the
// cart can't be read, so this is what keeps a second tap from doubling everything.
import type { ISODate } from '../../domain/dates.ts';
import { nextTrip } from '../../domain/shop-schedule.ts';
import { addSent, type CartLine, type SentToCart } from '../../domain/walmart.ts';
import type { Deps } from './deps.ts';
import { shopSchedule, tripOf } from './shop-schedule.ts';

const KEY = 'walmart_cart_sent';

type Saved = { shopDate: ISODate; items: SentToCart };

/** A new trip starts with nothing sent. */
export function sentToCart(deps: Deps, shopDate: ISODate): SentToCart {
  const saved = deps.household.setting(KEY);
  if (!saved) return {};
  const parsed = JSON.parse(saved) as Saved;
  return parsed.shopDate === tripOf(deps, shopDate) ? parsed.items : {};
}

export function noteSentToCart(deps: Deps, today: ISODate, lines: readonly CartLine[]): void {
  const shopDate = nextTrip(today, shopSchedule(deps));
  const saved: Saved = { shopDate: tripOf(deps, shopDate), items: addSent(sentToCart(deps, shopDate), lines) };
  deps.household.saveSetting(KEY, JSON.stringify(saved));
}

export function forgetSentToCart(deps: Pick<Deps, 'household'>): void {
  deps.household.saveSetting(KEY, null);
}
