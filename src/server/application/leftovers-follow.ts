// Leftovers follow what actually happened, whichever way a meal changed: a check-in, cook mode or a swap.
import { leftoversOfChange, sameDish } from '../../domain/leftovers.ts';
import type { PlanEntry } from '../../domain/plan.ts';
import type { Deps } from './deps.ts';
import { fridgeFollowsMeal } from './fridge.ts';

const FOREVER = '9999-12-31';

/**
 * Takes planned leftovers off when the meal they were of is now skipped or a different dish, and leaves
 * pinned ones as plain leftovers. Marking it made again brings nothing back: they're really gone, and
 * the slot may hold something else by then. Call it in the same transaction as the change.
 */
export function leftoversFollow(deps: Deps, before: PlanEntry | null, after: PlanEntry): void {
  fridgeFollowsMeal(deps, after);
  if (!before || before.outcome === 'skipped' || sameDish(before, after)) return;
  const { off, plain } = leftoversOfChange(deps.plan.range(before.date, FOREVER), before);
  for (const entry of off) deps.plan.remove(entry.date, entry.slot);
  for (const entry of plain) deps.plan.upsert(entry);
}
