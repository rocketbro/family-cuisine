// The plan as the screens show it.
import type { ISODate } from '../../domain/dates.ts';
import { offersLeftovers } from '../../domain/dinner-left.ts';
import { dishName, madeName } from '../../domain/leftovers.ts';
import { cookedSlug } from '../../domain/plan.ts';
import type { PlanEntryView } from '../../shared/views.ts';
import type { Deps } from './deps.ts';
import { dinnersLeft } from './dinner-left.ts';
import { recipeCard } from './recipe-views.ts';

export function planView(deps: Deps, from: ISODate, to: ISODate): PlanEntryView[] {
  const pantry = deps.pantry.list();
  const recipes = new Map(deps.recipes.list().map(r => [r.slug, r]));
  const entries = deps.plan.range(from, to);
  const said = dinnersLeft(deps);
  const titleOf = (slug: string) => recipes.get(slug)?.title ?? null;
  return entries.map(entry => {
    const recipe = recipes.get(cookedSlug(entry) ?? entry.recipeSlug ?? '');
    const madeTitle = madeName(entry, titleOf);
    const source = entry.leftoversOf ? deps.plan.get(entry.leftoversOf.date, entry.leftoversOf.slot) : null;
    return {
      ...entry,
      recipe: recipe && entry.kind !== 'leftovers' ? recipeCard(recipe, pantry, entry.multiplier) : null,
      leftoversTitle: source ? dishName(source, titleOf) : null,
      madeTitle,
      leftoversOffered: offersLeftovers(entry, madeTitle, said[entry.date]),
    };
  });
}
