// Putting a person's choice in a slot: what was there comes off, and its leftovers follow.
import { cameOffMeal, type CameOffMeal } from '../../domain/came-off.ts';
import type { PlanEntry } from '../../domain/plan.ts';
import type { Deps } from './deps.ts';
import { leftoversFollow } from './leftovers-follow.ts';

/** Says what came off, when it's a meal someone might want on another day. */
export function placeMeal(deps: Deps, entry: PlanEntry): CameOffMeal | null {
  return deps.unitOfWork.run(() => {
    const before = deps.plan.get(entry.date, entry.slot);
    deps.plan.upsert(entry);
    leftoversFollow(deps, before, entry);
    return cameOffMeal(before, entry, slug => deps.recipes.get(slug)?.title ?? null);
  });
}
