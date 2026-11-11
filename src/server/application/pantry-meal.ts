// "Roll the dice": the model puts together a meal from what's in the house. Nothing is saved
// until someone chooses it; rolling again just asks for something different.
import { recipeAvailability } from '../../domain/availability.ts';
import { addDays, toISODate, type ISODate } from '../../domain/dates.ts';
import { matchUses, PANTRY_MEAL_RETRY, type DraftedMeal } from '../../domain/drafted-meal.ts';
import { findPantryItem, type PantryItem } from '../../domain/pantry.ts';
import { isExtraSlot } from '../../domain/plan-slot.ts';
import { cookedSlug, type PlanEntry } from '../../domain/plan.ts';
import { batchFor } from './household-profile.ts';
import { leftoversInTheFridge } from './dinner-left.ts';
import { nightBeforeCheck } from './night-before-check.ts';
import { portionsText, useSoonText } from '../../domain/portions.ts';
import type { MealSlot, Recipe } from '../../domain/recipe.ts';
import { isPlausibleModelBatch } from '../../domain/scaling.ts';
import { inSeason, seasonOf } from '../../domain/seasons.ts';
import { goingOffSoon } from '../../domain/use-by.ts';
import type { Deps } from './deps.ts';
import type { PantryMealContext, SaidDraft } from './ports/ai.ts';
import { UserError } from './user-error.ts';

const LOOK_BACK_DAYS = 7;
const LOOK_AHEAD_DAYS = 6;
const USE_SOON_DAYS = 7;

export async function rollMeal(deps: Deps, date: ISODate, slot: MealSlot, notThese: string[]): Promise<DraftedMeal> {
  if (!deps.ai.available()) throw new UserError('Rolling the dice needs the Anthropic API key in .env.', 503);
  const pantry = deps.pantry.list();
  const inTime = nightBeforeCheck(deps);
  const recipes = deps.recipes.list().filter(r => r.meals.includes(slot) && inSeason(r, date) && inTime(r, date) && recipeAvailability(r.ingredients, pantry, batchFor(deps, r.serves)).level === 'ready');
  const draft = await deps.ai.draftMeal(mealContext(deps, date, slot, notThese, pantry, recipes));
  return checkedDraft(deps, draft, recipes, pantry);
}

function mealContext(
  deps: Deps, date: ISODate, slot: MealSlot, notThese: string[], pantry: PantryItem[], ready: Recipe[],
): PantryMealContext {
  const now = new Date();
  const today = toISODate(now);
  const all = new Map(deps.recipes.list().map(r => [r.slug, r]));
  const titleOf = (e: PlanEntry) => (e.kind === 'leftovers' ? 'leftovers' : all.get(cookedSlug(e) ?? '')?.title ?? e.note ?? '');
  const upcoming = deps.plan.range(date, addDays(date, LOOK_AHEAD_DAYS)).filter(e => !e.outcome && !(e.date === date && e.slot === slot));
  return {
    today, date, slot,
    timeNow: now.toTimeString().slice(0, 5),
    season: seasonOf(date),
    pantry: pantry.filter(p => p.status !== 'out').map(p => ({
      name: p.name, category: p.category, status: p.status, count: p.count, kept: p.portions.length ? portionsText(p.portions) : null, useBy: p.useBy,
    })),
    useSoon: goingOffSoon(pantry, today, USE_SOON_DAYS).map(useSoonText),
    recipes: ready.map(r => ({ slug: r.slug, title: r.title, time: r.time, serves: r.serves, ingredients: r.ingredients.filter(i => !i.optional).map(i => i.item) })),
    // A birthday cake isn't a dinner to avoid repeating; what an upcoming extra needs still gets left in the house.
    recentMeals: deps.plan.range(addDays(date, -LOOK_BACK_DAYS), addDays(date, -1)).flatMap(e => (e.outcome === 'skipped' || isExtraSlot(e.slot) ? [] : [{ date: e.date, slot: e.slot, title: titleOf(e) }])),
    leftovers: leftoversInTheFridge(deps, date, slug => all.get(slug)?.title ?? null),
    upcoming: upcoming.map(e => ({ date: e.date, title: titleOf(e), needs: all.get(cookedSlug(e) ?? '')?.ingredients.filter(i => !i.optional).map(i => i.item) ?? [] })),
    notThese,
    avoid: deps.avoided.list().map(({ title, reason }) => ({ title, reason })),
  };
}

/** Only real recipes and real pantry items get through, and nothing the recipe will take off itself. */
function checkedDraft(deps: Deps, draft: SaidDraft, ready: Recipe[], pantry: PantryItem[]): DraftedMeal {
  const recipe = draft.recipeSlug ? ready.find(r => r.slug === draft.recipeSlug) : null;
  if (recipe === undefined) throw new UserError(PANTRY_MEAL_RETRY, 502);
  const inRecipe = new Set((recipe?.ingredients ?? []).map(i => findPantryItem(i.item, pantry)?.id));
  const uses = matchUses(draft.uses, pantry).filter(use => !inRecipe.has(use.pantryItemId));
  if (!recipe && !uses.length) throw new UserError(PANTRY_MEAL_RETRY, 502);
  const multiplier = recipe ? (isPlausibleModelBatch(draft.multiplier) ? draft.multiplier : batchFor(deps, recipe.serves)) : 1;
  return { title: draft.title, why: draft.why, how: draft.how, recipeSlug: recipe?.slug ?? null, multiplier, uses };
}
