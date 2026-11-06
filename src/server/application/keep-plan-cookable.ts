import { addDays, type ISODate } from '../../domain/dates.ts';
import { leftoversOfRemoved, withoutSource, type PlanEntry } from '../../domain/plan.ts';
import { cookableCheck } from './cookable-check.ts';
import type { Deps } from './deps.ts';

/**
 * Takes off planner-chosen meals that can no longer be cooked before the groceries come (the pantry
 * changed since they were planned), and their leftovers, for the planning run to refill. Meals
 * someone chose themselves are never replaced, even leftovers: those stay, as plain leftovers with no source.
 */
export function keepPlanCookable(deps: Deps, today: ISODate): PlanEntry[] {
  const recipes = new Map(deps.recipes.list().map(r => [r.slug, r]));
  const canCook = cookableCheck(deps);
  const ahead = deps.plan.range(today, '9999-12-31');
  const stale = ahead.filter(e => e.date <= addDays(today, 7)).filter(e => {
    const recipe = e.kind === 'recipe' && !e.outcome && !e.pinned ? recipes.get(e.recipeSlug ?? '') : null;
    return recipe && !canCook(recipe, e.date, e.multiplier);
  });
  const leftovers = leftoversOfRemoved(ahead, stale);
  const removed = [...stale, ...leftovers.filter(e => !e.pinned)];
  deps.unitOfWork.run(() => {
    for (const entry of removed) deps.plan.remove(entry.date, entry.slot);
    for (const entry of leftovers.filter(e => e.pinned)) deps.plan.upsert(withoutSource(entry));
  });
  return removed;
}
