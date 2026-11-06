// The whole stock-up list is saved at once, in order, so each change is a new list. Fresh from the
// server each time, so one phone's save doesn't undo another's.
import type { StockGoalInput, StockGoalView } from '../../../../shared/api-types.ts';

export const asInput = ({ pantryItemId, goal }: StockGoalView): StockGoalInput =>
  ({ pantryItemId, amount: goal.amount, unit: goal.unit, storage: goal.storage });

/** Changes the goal where it is, or adds it to the bottom of the list. */
export function withGoal(list: readonly StockGoalInput[], goal: StockGoalInput): StockGoalInput[] {
  return list.some(g => g.pantryItemId === goal.pantryItemId)
    ? list.map(g => (g.pantryItemId === goal.pantryItemId ? goal : g))
    : [...list, goal];
}

export function withoutGoal(list: readonly StockGoalInput[], pantryItemId: number): StockGoalInput[] {
  return list.filter(g => g.pantryItemId !== pantryItemId);
}

/** One place up or down. Off either end, it stays where it is. */
export function movedGoal(list: readonly StockGoalInput[], pantryItemId: number, by: -1 | 1): StockGoalInput[] {
  const from = list.findIndex(g => g.pantryItemId === pantryItemId);
  const to = from + by;
  if (from < 0 || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}
