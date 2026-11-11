// Someone looking over an imported plan says what to change. Claude works on the plan as it stands
// on their screen, their own taps included, and the answer goes back to the screen. Nothing is
// saved here: that's the review's Save, the same as for changes made by hand.
import type { ISODate } from '../../domain/dates.ts';
import type { ImportedMeal } from '../../domain/plan-import.ts';
import type { Deps } from './deps.ts';
import { checkedMeals } from './plan-import-check.ts';
import { usableRecipes } from './plan-import.ts';
import { loadPlanImport } from './plan-import-record.ts';
import { UserError } from './user-error.ts';

const NOT_UNDERSTOOD = 'Claude couldn’t tell what to change, so nothing changed.';

export type PlanRevisionInput = { said: string; onDate: ISODate | null; meals: readonly ImportedMeal[] };
export type PlanRevision = { meals: ImportedMeal[]; note: string };

export async function revisePlanImport(deps: Deps, id: string, input: PlanRevisionInput, today: ISODate): Promise<PlanRevision> {
  if (!deps.ai.available()) throw new UserError('Changing a plan by talking needs the Anthropic API key in .env.', 503);
  const record = loadPlanImport(deps);
  if (record?.id !== id || record.status !== 'ready') throw new UserError('That plan was already saved, or a newer one took its place.', 409);
  const said = input.said.trim();
  if (!said) throw new UserError('We didn’t catch anything. Try again a little closer to the phone.');

  const recipes = usableRecipes(deps, record.claudesIdeas);
  const answer = await deps.ai.revisePlan({
    said,
    onDate: input.onDate,
    today,
    recipes: recipes.map(r => ({ slug: r.slug, title: r.title, tags: r.tags })),
    meals: input.meals.map(({ said: words, date, slot, match, confidence }) => ({
      said: words, date, slot, confidence,
      kind: match.kind,
      recipeSlug: match.kind === 'recipe' ? match.slug : null,
      name: match.kind === 'named' ? match.name : null,
    })),
  });
  if (!answer.understood) throw new UserError(answer.note.trim() || NOT_UNDERSTOOD, 422);
  // Every date here is an answer, so the written-order walk has nothing to work out.
  return { meals: checkedMeals(answer.meals.map(meal => ({ ...meal, weekday: null })), recipes, record.range), note: answer.note.trim() };
}
