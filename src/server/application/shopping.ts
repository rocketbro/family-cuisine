// The week's shopping: which store, what to get, and the one-tap Walmart cart.
import type { ISODate } from '../../domain/dates.ts';
import { nextTrip, regularFor, tripCoversThrough } from '../../domain/shop-schedule.ts';
import { shopSchedule } from './shop-schedule.ts';
import type { PantryItem, Store } from '../../domain/pantry.ts';
import { restocked } from '../../domain/portions.ts';
import { COUNT_ASSUMED_BOUGHT, isSameTripLine, repeatsCheckOff } from '../../domain/receipts.ts';
import { buildShoppingList, storeFor } from '../../domain/shopping.ts';
import { fillStockUp, stockCents } from '../../domain/stock-up.ts';
import { addSent, unsentLines, walmartCartUrl } from '../../domain/walmart.ts';
import { groceryTaxRate, listTax } from '../../domain/grocery-tax.ts';
import { budgetRoom, lineCents, listTotal, needsLookup, packsFromProducts } from '../../domain/prices.ts';
import { recentMisses } from './lookup-misses.ts';
import { firstTimeOnly } from './put-away-requests.ts';
import { noteCheckedOff } from './receipts.ts';
import { putAwayStock } from './stock-up.ts';
import { updatePantryItem } from './pantry.ts';
import { storeLocation } from './store-location.ts';
import { lookupRunning } from './lookup-state.ts';
import type { Deps } from './deps.ts';
import { tripBudget } from './budget.ts';
import { changeTripPlan, tripPlan } from './trip-plan.ts';
import { sentToCart } from './walmart-cart.ts';
import type { PricedLine, ShoppingWeek } from '../../shared/api-types.ts';

export const DEFAULT_STORE: Store = 'aldi';

export function shoppingWeek(deps: Deps, today: ISODate): ShoppingWeek {
  const schedule = shopSchedule(deps);
  const shopDate = nextTrip(today, schedule);
  const through = tripCoversThrough(shopDate, schedule);
  const chosen = deps.household.storeFor(shopDate);
  const store = chosen ?? DEFAULT_STORE;
  const prices = { aldi: deps.prices.forStore('aldi'), walmart: deps.prices.forStore('walmart') };
  const lines = buildShoppingList({
    entries: deps.plan.range(shopDate, through),
    recipes: new Map(deps.recipes.list().map(r => [r.slug, r])),
    pantry: deps.pantry.list(),
    weekStore: store,
    from: shopDate,
    to: through,
    productPacks: { aldi: packsFromProducts(prices.aldi), walmart: packsFromProducts(prices.walmart) },
  });
  const priced = lines.map(line => ({ ...line, price: line.pantryItemId !== null ? prices[line.store].get(line.pantryItemId) ?? null : null }));
  const walmart = lines.filter(l => l.store === 'walmart');
  const moved = regularFor(shopDate, schedule);
  const total = listTotal(priced.map(l => l.price && { ...l.price, cents: lineCents(l, l.price) }));
  const location = storeLocation(deps);
  const rate = location ? groceryTaxRate(location.place) : null;
  const tax = listTax(total.cents, rate);
  const budget = tripBudget(deps);
  const leeway = budgetRoom(budget, total, total.cents + (tax?.cents ?? 0));
  const plan = tripPlan(deps, shopDate);
  const finds = store === 'aldi' && leeway !== null ? Math.min(plan.findsCents, leeway) : 0;
  const stockUp = fillStockUp({
    items: deps.pantry.list(),
    storeFor: item => storeFor(item, store),
    priceOf: (item, itemStore) => prices[itemStore].get(item.id)?.cents ?? null,
    // Whatever goes in the basket gets taxed too.
    spendable: leeway === null ? null : Math.floor((leeway - finds) / (1 + (rate ?? 0))),
    chosen: plan.chosen,
    bought: plan.bought,
  });
  // The item's own cart quantity: a counted line's quantity is eggs, not cartons.
  const needed = walmart.filter(l => l.walmartItemId).map(l => ({ itemId: l.walmartItemId!, quantity: l.packages }));
  const extras = stockUp.filter(l => l.store === 'walmart' && l.walmartItemId && l.packages > 0).map(l => ({ itemId: l.walmartItemId!, quantity: l.packages }));
  const cartLines = Object.entries(addSent({}, [...needed, ...extras])).map(([itemId, quantity]) => ({ itemId, quantity }));
  const toSend = unsentLines(cartLines, sentToCart(deps, shopDate));
  return {
    shopDate, through, movedFrom: moved === shopDate ? null : moved, store, storeChosen: chosen !== null, lines: priced,
    total, tax, budgetCents: budget, leewayCents: leeway, findsCents: finds, stockUp, stockTotalCents: stockCents(stockUp),
    aldiLookup: aldiLookupState(deps, priced),
    walmartCartUrl: walmartCartUrl(toSend),
    walmartToSend: toSend,
    walmartSentCount: cartLines.length - toSend.length,
    walmartUnmatched: walmart.filter(l => !l.walmartItemId).map(l => l.name),
  };
}

/** Remembers how much of each is meant for the store, so a receipt can tell it from what the meals need. */
export function keepStockPlan(deps: Deps, week: Pick<ShoppingWeek, 'shopDate' | 'stockUp'>): void {
  changeTripPlan(deps, week.shopDate, () => ({ planned: Object.fromEntries(week.stockUp.map(l => [l.pantryItemId, l.packages])) }));
}

export function chooseStore(deps: Deps, today: ISODate, store: Store): void {
  deps.household.setStore(nextTrip(today, shopSchedule(deps)), store);
}

type BoughtLine = { pantryItemId: number | null; name: string; quantity: number | null };

/**
 * Checking items off at the store puts them back in the pantry, all together. The app's token says
 * which lines this put-away already did, so sending it again can't add twice, whatever has changed
 * since. Without one, a repeat is judged per trip and line by the count it left behind.
 */
export function markBought(
  deps: Deps, lines: BoughtLine[], today: ISODate, stock: { pantryItemId: number; packages: number }[] = [],
  token: string | null = null,
): void {
  const trip = nextTrip(today, shopSchedule(deps));
  deps.unitOfWork.run(() => {
    const saved = deps.receipts.tripList(trip) ?? [];
    const checkedOff = [];
    const lineId = (line: BoughtLine) => `line:${line.pantryItemId ?? line.name}`;
    const stockId = (line: { pantryItemId: number }) => `stock:${line.pantryItemId}`;
    const fresh = firstTimeOnly(deps, token, [...lines.map(lineId), ...stock.map(stockId)]);
    for (const line of lines.filter(l => fresh.has(lineId(l)))) {
      const item = (line.pantryItemId !== null ? deps.pantry.get(line.pantryItemId) : null) ?? deps.pantry.findByName(line.name);
      if (item && repeatsCheckOff(saved.find(s => isSameTripLine(s, line)), item.count)) continue;
      checkedOff.push({ ...line, countAfter: putBack(deps, item, line) });
    }
    noteCheckedOff(deps, trip, deps.household.storeFor(trip) ?? DEFAULT_STORE, checkedOff);
    for (const { pantryItemId, packages } of stock.filter(s => fresh.has(stockId(s)))) putAwayStock(deps, today, pantryItemId, packages);
  });
}

/** Returns a counted item's new count. */
function putBack(deps: Deps, item: PantryItem | null, line: BoughtLine): number | null {
  if (!item) {
    deps.pantry.create({ name: line.name, status: 'have' });
    return null;
  }
  if (item.count !== null) return updatePantryItem(deps, item.id, { count: item.count + (line.quantity ?? COUNT_ASSUMED_BOUGHT), status: 'have' })?.count ?? null;
  // More just came home, so that amount isn't known any more; the freezer hasn't changed.
  updatePantryItem(deps, item.id, item.portions.length ? { status: 'have', portions: [restocked(item.portions)] } : { status: 'have' });
  return null;
}

function aldiLookupState(deps: Deps, lines: PricedLine[]): ShoppingWeek['aldiLookup'] {
  if (!deps.storePrices) return 'disabled';
  if (!storeLocation(deps)) return 'off';
  if (lookupRunning(deps.lookups)) return 'running';
  const now = new Date();
  const misses = recentMisses(deps, now);
  return lines.some(l => l.store === 'aldi' && needsLookup(l.price, now) && !misses.has(l.name)) ? 'due' : 'done';
}

