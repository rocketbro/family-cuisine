// Plan entries that break the app's own rules, with only one way to put them right.
import { leftoversFit } from './leftovers.ts';
import { entryKey, stillOnlyPlanned, type PlanEntry } from './plan.ts';
import { slotLabel } from './plan-slot.ts';
import type { Fix, TidyInputs } from './tidy-types.ts';

const where = (entry: Pick<PlanEntry, 'date' | 'slot'>) => `${slotLabel(entry.slot).toLowerCase()} on ${entry.date}`;

/** A planned meal for a recipe that's no longer in the book: removing a recipe takes its meals off, so this one got through. */
export function danglingMeals({ plan, recipes, recipesTrustworthy }: Pick<TidyInputs, 'plan' | 'recipes' | 'recipesTrustworthy'>): Fix[] {
  if (!recipesTrustworthy) return [];
  const slugs = new Set(recipes.map(r => r.slug));
  return plan
    .filter(e => e.kind === 'recipe' && e.recipeSlug && !slugs.has(e.recipeSlug) && stillOnlyPlanned(e))
    .map((e): Fix => ({ check: 'missing-recipe', line: `Took the ${where(e)} off the plan: its recipe is gone`, step: { step: 'remove_entry', date: e.date, slot: e.slot } }));
}

/**
 * Planned leftovers still to come that can't be what they say: the dinner is gone or was skipped, or they fall
 * outside LEFTOVERS_LAST_DAYS. Moving or changing a meal treats these the same way: the app's come off, a person's lose their source.
 */
export function strandedLeftovers({ plan, today }: Pick<TidyInputs, 'plan' | 'today'>): Fix[] {
  const byKey = new Map(plan.map(e => [entryKey(e), e]));
  return plan.flatMap((e): Fix[] => {
    if (e.kind !== 'leftovers' || !e.leftoversOf || e.outcome || e.date < today) return [];
    const source = byKey.get(entryKey(e.leftoversOf));
    const gone = !source || source.outcome === 'skipped';
    if (!gone && leftoversFit(e, e.leftoversOf)) return [];
    const reason = gone ? 'the dinner they were of is gone' : 'they come too long after it';
    return e.pinned
      ? [{ check: 'stranded-leftovers', line: `Made the ${where(e)} plain leftovers: ${reason}`, step: { step: 'unlink_entry', date: e.date, slot: e.slot } }]
      : [{ check: 'stranded-leftovers', line: `Took the ${where(e)} off the plan: ${reason}`, step: { step: 'remove_entry', date: e.date, slot: e.slot } }];
  });
}
