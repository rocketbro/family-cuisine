// Whether the evening check-in still has anything to ask about a day. A meal marked from the Today screen
// is answered right there, so a day with every meal marked and its questions settled has nothing left to say.
import { checkinQuestions } from './checkin.ts';
import type { ISODate } from './dates.ts';
import { asksAnyLeft, type DinnerLeft } from './dinner-left.ts';
import type { PantryItem } from './pantry.ts';
import type { PlanEntry } from './plan.ts';
import type { Recipe } from './recipe.ts';

/** `meals` is the day's plan, extras included. Nothing planned means nothing to mark. */
export function checkinLeftToAsk(
  meals: readonly PlanEntry[], date: ISODate, recipes: ReadonlyMap<string, Recipe>, pantry: readonly PantryItem[], anyLeft: DinnerLeft | undefined,
): boolean {
  if (meals.some(meal => !meal.outcome)) return true;
  if (asksAnyLeft(meals) && !anyLeft) return true;
  const { counts, needs, uses } = checkinQuestions(meals, date, recipes, pantry);
  return counts.length + needs.length + uses.length > 0;
}
