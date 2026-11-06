// The short list of things worth building up, and what buying them does to the store.
import type { ISODate } from '../../domain/dates.ts';
import { nextTrip } from '../../domain/shop-schedule.ts';
import type { PantryItem } from '../../domain/pantry.ts';
import { amountStored, heldForGoal, splitForStock, stockStanding, type StockGoal, type StockSplit } from '../../domain/stock-up.ts';
import type { Storage } from '../../domain/portions.ts';
import type { Unit } from '../../domain/units.ts';
import type { StockGoalView } from '../../shared/api-types.ts';
import type { Deps } from './deps.ts';
import { updatePantryItem } from './pantry.ts';
import { shopSchedule } from './shop-schedule.ts';
import { changeTripPlan, tripPlan } from './trip-plan.ts';
import { UserError } from './user-error.ts';

export type GoalInput = { pantryItemId: number; amount: number; unit: Unit | null; storage: Storage };

export function stockUpList(deps: Pick<Deps, 'pantry'>): StockGoalView[] {
  return deps.pantry.list()
    .filter((item): item is PantryItem & { stockUp: StockGoal } => item.stockUp !== null)
    .sort((a, b) => a.stockUp.rank - b.stockUp.rank)
    .map(item => ({ pantryItemId: item.id, name: item.name, goal: item.stockUp, standing: stockStanding(item, item.stockUp), pack: item.packSize, linked: item.walmartItemId !== null }));
}

/** Replaces the list, in the order given. Every goal names an item already in the pantry. */
export function setStockUpList(deps: Pick<Deps, 'pantry' | 'unitOfWork'>, goals: readonly GoalInput[]): void {
  const keep = new Set(goals.map(g => g.pantryItemId));
  if (keep.size < goals.length) throw new UserError('That item is on the list twice.');
  deps.unitOfWork.run(() => {
    const items = deps.pantry.list();
    const inPantry = new Set(items.map(item => item.id));
    if (goals.some(g => !inPantry.has(g.pantryItemId))) throw new UserError('That item isn’t in the Pantry anymore. Add it there first.', 404);
    for (const item of items) {
      if (item.stockUp && !keep.has(item.id)) deps.pantry.update(item.id, { stockUp: null });
    }
    goals.forEach(({ pantryItemId, amount, unit, storage }, rank) => {
      deps.pantry.update(pantryItemId, { stockUp: { amount, unit, storage, rank } });
    });
  });
}

/**
 * Puts bought packages away where the goal keeps them, and takes them off this trip's list. The
 * list stops offering an item once any of it is bought, so a repeat is the same request again.
 */
export function putAwayStock(deps: Deps, today: ISODate, pantryItemId: number, packages: number): void {
  const item = deps.pantry.get(pantryItemId);
  if (!item?.stockUp || packages <= 0) return;
  const { stockUp } = item;
  const trip = nextTrip(today, shopSchedule(deps));
  deps.unitOfWork.run(() => {
    if (tripPlan(deps, trip).bought[pantryItemId]) return;
    store(deps, item, stockUp, amountStored(item, stockUp, packages, null, 1));
    changeTripPlan(deps, trip, plan => ({ bought: { ...plan.bought, [pantryItemId]: packages } }));
  });
}

/** How a receipt line divides up, with the newly bought packages for the store put there. */
export function storeFromReceipt(
  deps: Deps, shopDate: ISODate, item: PantryItem, line: { quantity: number; weightLb: number | null },
): StockSplit {
  if (!item.stockUp) return { recorded: 0, stored: 0, remainder: line.quantity };
  const plan = tripPlan(deps, shopDate);
  const split = splitForStock(line.quantity, { planned: plan.planned[item.id] ?? 0, bought: plan.bought[item.id] ?? 0, matched: plan.matched[item.id] ?? 0 });
  if (split.stored > 0) store(deps, item, item.stockUp, amountStored(item, item.stockUp, split.stored, line.weightLb, split.stored / line.quantity));
  if (split.remainder < line.quantity) {
    changeTripPlan(deps, shopDate, p => ({
      bought: { ...p.bought, [item.id]: (p.bought[item.id] ?? 0) + split.stored },
      matched: { ...p.matched, [item.id]: (p.matched[item.id] ?? 0) + split.recorded + split.stored },
    }));
  }
  return split;
}

function store(deps: Deps, item: PantryItem, goal: StockGoal, added: number | null): void {
  const held = heldForGoal(item, goal);
  // Not knowing how much came home still means there's some.
  const amount = added === null ? (held > 0 ? held : null) : Math.round((held + added) * 100) / 100;
  updatePantryItem(deps, item.id, { status: 'have', portions: [{ storage: goal.storage, amount, unit: goal.unit }] });
}
