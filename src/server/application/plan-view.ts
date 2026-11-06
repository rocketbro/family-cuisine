// The plan as the screens show it.
import type { ISODate } from '../../domain/dates.ts';
import { cookedSlug } from '../../domain/plan.ts';
import type { PlanEntryView } from '../../shared/views.ts';
import type { Deps } from './deps.ts';
import { recipeCard } from './recipe-views.ts';

export function planView(deps: Deps, from: ISODate, to: ISODate): PlanEntryView[] {
  const pantry = deps.pantry.list();
  const recipes = new Map(deps.recipes.list().map(r => [r.slug, r]));
  const entries = deps.plan.range(from, to);
  return entries.map(entry => {
    const recipe = recipes.get(cookedSlug(entry) ?? entry.recipeSlug ?? '');
    const source = entry.leftoversOf ? deps.plan.get(entry.leftoversOf.date, entry.leftoversOf.slot) : null;
    const sourceRecipe = source ? recipes.get(cookedSlug(source) ?? '') : null;
    return {
      ...entry,
      recipe: recipe && entry.kind !== 'leftovers' ? recipeCard(recipe, pantry, entry.multiplier) : null,
      leftoversTitle: sourceRecipe?.title ?? null,
    };
  });
}
