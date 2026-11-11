// Whether tonight's check-in has anything left to ask, for the notification that invites it.
import { checkinLeftToAsk as leftToAsk } from '../../domain/checkin-open.ts';
import type { ISODate } from '../../domain/dates.ts';
import type { Deps } from './deps.ts';
import { dinnersLeft } from './dinner-left.ts';

/** A check-in already finished has answered everything, including dinner leftovers it never got to ask about. */
export function checkinLeftToAsk(deps: Deps, date: ISODate): boolean {
  if (deps.household.checkin(date).pantryDone) return false;
  const meals = deps.plan.range(date, date);
  const recipes = new Map(meals.flatMap(m => (m.recipeSlug ? [m.recipeSlug] : [])).flatMap(slug => deps.recipes.get(slug) ?? []).map(r => [r.slug, r]));
  return leftToAsk(meals, date, recipes, deps.pantry.list(), dinnersLeft(deps)[date]);
}
