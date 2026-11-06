// Building up a store of the things worth keeping plenty of: a goal for how much to keep, and
// spending whatever the budget has left on getting there, most important first.
import type { PantryItem, Store } from './pantry.ts';
import { portionText, type Storage } from './portions.ts';
import { convert, dimensionOf, unitLabel, type Unit } from './units.ts';
import { formatAmount } from './quantity.ts';

/** "10 lb frozen". A null unit counts pieces. `rank` is the order money goes to them, lowest first. */
export type StockGoal = { amount: number; unit: Unit | null; storage: Storage; rank: number };

export type StockLine = {
  key: string;
  pantryItemId: number;
  name: string;
  store: Store;
  walmartItemId: string | null;
  /** How many packages go in this trip. */
  packages: number;
  /** Someone set the number themselves, rather than the budget working it out. */
  chosen: boolean;
  /** Each, or null when there's no price yet. */
  cents: number | null;
  /** "Have 3 lb frozen, aiming for 10 lb" */
  progress: string;
};

export function goalText(goal: Pick<StockGoal, 'amount' | 'unit'>): string {
  return goal.unit ? `${formatAmount(goal.amount)} ${unitLabel(goal.unit, goal.amount)}` : formatAmount(goal.amount);
}

const comparable = (from: Unit | null, to: Unit | null) =>
  from === to || (from !== null && to !== null && dimensionOf(from) !== 'count' && dimensionOf(from) === dimensionOf(to));

/** How much of the goal is there now. An amount nobody knows ("some") counts as none. */
export function heldForGoal(item: Pick<PantryItem, 'portions'>, goal: StockGoal): number {
  const portion = item.portions.find(p => p.storage === goal.storage);
  if (!portion || portion.amount === null || !comparable(portion.unit, goal.unit)) return 0;
  return portion.unit && goal.unit ? convert(portion.amount, portion.unit, goal.unit) : portion.amount;
}

/** One package, in the goal's unit. Null when the product's size isn't known or can't be compared. */
export function packageForGoal(item: Pick<PantryItem, 'packSize'>, goal: StockGoal): number | null {
  const pack = item.packSize;
  if (goal.unit === null || dimensionOf(goal.unit) === 'count') return pack?.count ?? (goal.unit === 'can' ? 1 : null);
  if (!pack?.measure || dimensionOf(pack.measure.unit) !== dimensionOf(goal.unit)) return null;
  return convert(pack.measure.amount, pack.measure.unit, goal.unit);
}

function packagesToGoal(item: PantryItem, goal: StockGoal): number {
  const short = goal.amount - heldForGoal(item, goal);
  if (short <= 0) return 0;
  const size = packageForGoal(item, goal);
  // Without a size, one a trip is as far as it can safely go.
  return size ? Math.ceil(short / size - 1e-6) : 1;
}

export function stockProgress(item: Pick<PantryItem, 'portions'>, goal: StockGoal): string {
  const portion = item.portions.find(p => p.storage === goal.storage);
  const held = portion ? portionText(portion) : `no ${goal.storage}`;
  return `Have ${held}, aiming for ${goalText(goal)}`;
}

/** Where a goal stands, for reading at a glance: "Have 3 lb frozen", "Goal 10 lb", and how far along. */
export type StockStanding = { have: string; goal: string; share: number };

export function stockStanding(item: Pick<PantryItem, 'portions'>, goal: StockGoal): StockStanding {
  const portion = item.portions.find(p => p.storage === goal.storage);
  return {
    have: portion ? `Have ${portionText(portion)}` : `None ${goal.storage} yet`,
    goal: `Goal ${goalText(goal)}`,
    share: Math.min(1, heldForGoal(item, goal) / goal.amount),
  };
}

type FillInput = {
  items: readonly PantryItem[];
  storeFor: (item: PantryItem) => Store;
  priceOf: (item: PantryItem, store: Store) => number | null;
  /** What's left to spend on this; null when the total isn't known well enough to spend any. */
  spendable: number | null;
  /** Numbers people set for this trip, by item. */
  chosen: Record<string, number>;
  /** Already bought and put away this trip. */
  bought: Record<string, number>;
};

/** Goes down the list a package at a time, so everything gets some before the first gets it all. */
export function fillStockUp({ items, storeFor, priceOf, spendable, chosen, bought }: FillInput): StockLine[] {
  const goals = items
    .filter((item): item is PantryItem & { stockUp: StockGoal } => item.stockUp !== null && !bought[item.id])
    .sort((a, b) => a.stockUp.rank - b.stockUp.rank);
  const lines = goals.map(item => {
    const store = storeFor(item);
    const set = chosen[item.id];
    return {
      item, room: packagesToGoal(item, item.stockUp),
      line: {
        key: `stock:${item.id}`, pantryItemId: item.id, name: item.name, store, walmartItemId: item.walmartItemId,
        packages: set ?? 0, chosen: set !== undefined, cents: priceOf(item, store), progress: stockProgress(item, item.stockUp),
      } satisfies StockLine,
    };
  });
  let left = (spendable ?? 0) - lines.reduce((sum, { line }) => sum + (line.cents ?? 0) * line.packages, 0);
  for (let added = spendable !== null; added;) {
    added = false;
    for (const { line, room } of lines) {
      if (line.chosen || line.cents === null || line.packages >= room || line.cents > left) continue;
      line.packages += 1;
      left -= line.cents;
      added = true;
    }
  }
  // Nothing to do and nobody asked: it doesn't need a row.
  return lines.filter(({ line, room }) => room > 0 || line.chosen).map(({ line }) => line);
}

export function stockCents(lines: readonly StockLine[]): number {
  return lines.reduce((sum, line) => sum + (line.cents ?? 0) * line.packages, 0);
}

/** What's known about one item's packages on a trip. `matched` is how much of `bought` a receipt has already accounted for. */
export type StockLedger = { planned: number; bought: number; matched: number };

/** A receipt line's packages: put away already and only now seen on a receipt, newly going to the store, and the rest for the meals. */
export type StockSplit = { recorded: number; stored: number; remainder: number };

export function splitForStock(quantity: number, { planned, bought, matched }: StockLedger): StockSplit {
  const recorded = Math.min(Math.max(0, bought - matched), quantity);
  const stored = Math.min(Math.max(0, planned - bought), quantity - recorded);
  return { recorded, stored, remainder: quantity - recorded - stored };
}

/** A bought line split between meals and the store: how much goes away, in the goal's unit. Null if it can't be told. */
export function amountStored(
  item: Pick<PantryItem, 'packSize'>, goal: StockGoal, packages: number, weightLb: number | null, share: number,
): number | null {
  if (weightLb !== null && goal.unit && dimensionOf(goal.unit) === 'mass') return convert(weightLb * share, 'lb', goal.unit);
  const size = packageForGoal(item, goal);
  return size === null ? null : size * packages;
}
