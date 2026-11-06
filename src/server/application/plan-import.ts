// Importing a meal plan someone wrote out: read in the background so a sleeping phone can't lose it,
// looked over on a review screen, and saved only when they confirm. One at a time, kept in a
// household setting. Photos aren't kept after the read, unlike receipts: they're no household record.
import { clashingSlots, assumedWeekStart, type ImportedMeal, type ImportMatch, type ImportPlacement } from '../../domain/plan-import.ts';
import { WEEKDAYS, realDateOrNull, type ISODate } from '../../domain/dates.ts';
import type { Recipe } from '../../domain/recipe.ts';
import type { PlanImportView } from '../../shared/api-types.ts';
import type { Deps } from './deps.ts';
import { addExtra } from './plan-extras.ts';
import type { SaidPlanMeal } from './ports/ai.ts';
import { placeChoice } from './set-meal.ts';
import { UserError } from './user-error.ts';

const SETTING = 'plan_import';
/** Past this, a read that never finished died with a restart. */
const READING_LIMIT_MS = 5 * 60 * 1000;
/** A saved import stops being what the screen opens to. */
const SAVED_SHOWS_MS = 24 * 60 * 60 * 1000;
const MOST_MEALS = 60;
const MOST_NAME = 120;
const TRY_AGAIN = 'Couldn’t read that plan.';
const NEEDS_KEY = 'Reading a meal plan needs the Anthropic API key in .env.';

type PlanImportRecord = { id: string; createdAt: string; text: string | null; hadPhotos: boolean } & (
  | { status: 'reading' }
  | { status: 'failed'; error: string }
  | { status: 'ready'; meals: ImportedMeal[]; weekStart: ISODate }
  | { status: 'saved'; saved: number; leftAlone: number }
);

function load(deps: Deps): PlanImportRecord | null {
  const stored = deps.household.setting(SETTING);
  return stored ? JSON.parse(stored) as PlanImportRecord : null;
}

function keep(deps: Deps, record: PlanImportRecord | null): void {
  deps.household.saveSetting(SETTING, record && JSON.stringify(record));
}

export function planImportView(deps: Deps, now = new Date()): PlanImportView {
  const record = load(deps);
  if (!record) return { status: 'none' };
  const age = now.getTime() - new Date(record.createdAt).getTime();
  const canRetry = record.text !== null && !record.hadPhotos;
  switch (record.status) {
    case 'reading': return age > READING_LIMIT_MS
      ? { status: 'failed', id: record.id, error: 'That took too long.', canRetry }
      : { status: 'reading', id: record.id };
    case 'failed': return { status: 'failed', id: record.id, error: record.error, canRetry };
    case 'ready': return { status: 'ready', id: record.id, meals: record.meals, weekStart: record.weekStart };
    case 'saved': return age > SAVED_SHOWS_MS ? { status: 'none' } : { status: 'saved', id: record.id, saved: record.saved, leftAlone: record.leftAlone };
  }
}

/** Starts reading a plan and answers straight away. Anything earlier that wasn't confirmed is dropped. */
export function startPlanImport(deps: Deps, input: { text: string | null; photos: Buffer[] }, today: ISODate): string {
  if (!deps.ai.available()) throw new UserError(NEEDS_KEY, 503);
  const text = input.text?.trim() || null;
  if (!text && !input.photos.length) throw new UserError('Add a photo of the plan, or type it in.');
  const id = crypto.randomUUID();
  keep(deps, { id, createdAt: new Date().toISOString(), text, hadPhotos: input.photos.length > 0, status: 'reading' });
  void readPlan(deps, id, text, input.photos, today);
  return id;
}

/** Only words can be read again, since photos aren't kept. */
export function retryPlanImport(deps: Deps, today: ISODate): void {
  if (!deps.ai.available()) throw new UserError(NEEDS_KEY, 503);
  const record = load(deps);
  if (record?.status !== 'failed' && record?.status !== 'reading') throw new UserError('There’s nothing to read again.', 409);
  if (record.hadPhotos || !record.text) throw new UserError('Add the photo again to read it.', 409);
  keep(deps, { id: record.id, createdAt: new Date().toISOString(), text: record.text, hadPhotos: false, status: 'reading' });
  void readPlan(deps, record.id, record.text, [], today);
}

export function discardPlanImport(deps: Deps): void {
  keep(deps, null);
}

async function readPlan(deps: Deps, id: string, text: string | null, photos: Buffer[], today: ISODate): Promise<void> {
  try {
    const recipes = deps.recipes.list();
    const images = await Promise.all(photos.map(p => deps.photos.forModel(p)));
    const said = await deps.ai.readMealPlan({ text, images }, { today, recipes: recipes.map(r => ({ slug: r.slug, title: r.title, tags: r.tags })) });
    const meals = checkedMeals(said, recipes);
    if (!meals.length) throw new UserError('We couldn’t find any meals in that. Try a clearer photo, or type it in.');
    finishRead(deps, id, { status: 'ready', meals, weekStart: assumedWeekStart(meals, today) });
  } catch (e) {
    deps.log(`a meal plan couldn't be read: ${(e as Error).message}`);
    finishRead(deps, id, { status: 'failed', error: e instanceof UserError ? e.message : TRY_AGAIN });
  }
}

/** A newer import, or someone discarding this one, wins over a read that was still going. */
function finishRead(deps: Deps, id: string, result: { status: 'ready'; meals: ImportedMeal[]; weekStart: ISODate } | { status: 'failed'; error: string }): void {
  const record = load(deps);
  if (record?.id !== id || record.status !== 'reading') return;
  const { createdAt, text, hadPhotos } = record;
  keep(deps, { id, createdAt, text, hadPhotos, ...result });
}

/** The model's words stay data: only real recipes and real dates get through, and names are only ever text on a screen. */
function checkedMeals(said: readonly SaidPlanMeal[], recipes: readonly Recipe[]): ImportedMeal[] {
  const bySlug = new Map(recipes.map(r => [r.slug, r]));
  return said.slice(0, MOST_MEALS).flatMap(meal => {
    const words = meal.said.trim().slice(0, MOST_NAME);
    const name = (meal.name?.trim() || words).slice(0, MOST_NAME);
    const recipe = meal.kind === 'recipe' ? bySlug.get(meal.recipeSlug ?? '') : null;
    if (!recipe && !name && meal.kind !== 'leftovers') return [];
    const match: ImportMatch = recipe ? { kind: 'recipe', slug: recipe.slug, title: recipe.title }
      : meal.kind === 'leftovers' ? { kind: 'leftovers' }
      : { kind: 'named', name };
    const weekday = meal.weekday ? WEEKDAYS.indexOf(meal.weekday) : -1;
    return [{
      said: words, date: realDateOrNull(meal.date), weekday: weekday < 0 ? null : weekday,
      // There's no such thing as leftovers on top of a day's meals.
      slot: match.kind === 'leftovers' && meal.slot === 'extra' ? 'lunch' : meal.slot,
      match,
      // Someone wrote a recipe the model named but the book doesn't have: that's no sure thing.
      confidence: meal.kind === 'recipe' && !recipe ? 'unsure' : meal.confidence,
    }];
  });
}

/**
 * Saves what a person looked over, all of it or none, and as chosen by them: pinned, so nothing
 * replaces it on its own. A meal already made stays as it was, and so does a day that's gone by.
 */
export function confirmPlanImport(deps: Deps, id: string, placements: readonly ImportPlacement[], today: ISODate): void {
  deps.unitOfWork.run(() => {
    const record = load(deps);
    if (record?.id !== id || record.status !== 'ready') throw new UserError('That plan was already saved, or a newer one took its place.', 409);
    if (clashingSlots(placements).size) throw new UserError('Two meals are set for the same slot. Change one of them first.');
    let saved = 0;
    let leftAlone = 0;
    for (const { date, slot, match } of placements) {
      if (date < today) { leftAlone++; continue; }
      if (slot === 'extra') {
        if (match.kind === 'leftovers') throw new UserError('Leftovers can’t be an extra. Choose a meal for them.');
        addExtra(deps, date, match.kind === 'recipe' ? { kind: 'recipe', recipeSlug: match.slug } : { kind: 'note', note: match.name });
        saved++;
      } else if (deps.plan.get(date, slot)?.outcome) {
        leftAlone++;
      } else {
        placeChoice(deps, date, slot, match.kind === 'recipe' ? { kind: 'recipe', recipeSlug: match.slug }
          : match.kind === 'leftovers' ? { kind: 'leftovers', leftoversOf: null }
          : { kind: 'note', note: match.name });
        saved++;
      }
    }
    keep(deps, { id, createdAt: new Date().toISOString(), text: null, hadPhotos: record.hadPhotos, status: 'saved', saved, leftAlone });
  });
}
