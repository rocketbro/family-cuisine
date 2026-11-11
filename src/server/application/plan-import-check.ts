// What the model read off a plan stays data. Only recipes in the book it was shown and real dates
// get through, names are only ever text on a screen, and days are worked out here, in written order.
import { WEEKDAYS, realDateOrNull } from '../../domain/dates.ts';
import { datesInWrittenOrder } from '../../domain/plan-import-days.ts';
import type { ImportedMeal, ImportMatch, ImportRange } from '../../domain/plan-import.ts';
import type { Recipe } from '../../domain/recipe.ts';
import type { SaidPlanMeal } from './ports/ai.ts';

const MOST_MEALS = 60;
const MOST_NAME = 120;

export function checkedMeals(said: readonly SaidPlanMeal[], recipes: readonly Recipe[], range: ImportRange): ImportedMeal[] {
  const bySlug = new Map(recipes.map(r => [r.slug, r]));
  const lines = said.slice(0, MOST_MEALS).flatMap(meal => {
    const words = meal.said.trim().slice(0, MOST_NAME);
    const name = (meal.name?.trim() || words).slice(0, MOST_NAME);
    const recipe = meal.kind === 'recipe' ? bySlug.get(meal.recipeSlug ?? '') : null;
    if (!recipe && !name && meal.kind !== 'leftovers') return [];
    const match: ImportMatch = recipe ? { kind: 'recipe', slug: recipe.slug, title: recipe.title }
      : meal.kind === 'leftovers' ? { kind: 'leftovers' }
      : { kind: 'named', name };
    const weekday = meal.weekday ? WEEKDAYS.indexOf(meal.weekday) : -1;
    return [{
      said: words, written: { date: realDateOrNull(meal.date), weekday: weekday < 0 ? null : weekday },
      // There's no such thing as leftovers on top of a day's meals.
      slot: match.kind === 'leftovers' && meal.slot === 'extra' ? 'lunch' as const : meal.slot,
      match,
      // Someone wrote a recipe the model named but the book doesn't have: that's no sure thing.
      confidence: meal.kind === 'recipe' && !recipe ? 'unsure' as const : meal.confidence,
    }];
  });
  const dates = datesInWrittenOrder(lines.map(line => line.written), range);
  return lines.map(({ written: _written, ...line }, i) => ({ ...line, date: dates[i] }));
}
