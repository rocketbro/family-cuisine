// The size of a meal as planned, for when what was cooked instead turns out not to be what happened.
import type { PlanEntry } from '../../domain/plan.ts';
import type { Deps } from './deps.ts';
import { batchFor } from './household-profile.ts';

/** A swap to another recipe wrote that dish's size over the multiplier. Going back, it's this dish's batch again. */
export function sizeWithoutSwap(deps: Deps, entry: PlanEntry): number {
  const planned = entry.outcome === 'swapped' && entry.outcomeSlug && entry.kind === 'recipe' ? deps.recipes.get(entry.recipeSlug ?? '') : null;
  return planned ? batchFor(deps, planned.serves) : entry.multiplier;
}
