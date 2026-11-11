// Importing a meal plan someone wrote out: read in the background so a sleeping phone can't lose it,
// looked over on a review screen, and saved only when they confirm. One at a time, kept in a
// household setting. Photos aren't kept after the read, unlike receipts: they're no household record.
import { dateRange, realDateOrNull, type ISODate } from '../../domain/dates.ts';
import { clashingSlots, defaultImportRange, type ImportedMeal, type ImportPlacement, type ImportRange } from '../../domain/plan-import.ts';
import type { Recipe } from '../../domain/recipe.ts';
import type { PlanImportView } from '../../shared/api-types.ts';
import { resumeAutomaticPlanning } from './automatic-planning.ts';
import type { Deps } from './deps.ts';
import { addExtra } from './plan-extras.ts';
import { checkedMeals } from './plan-import-check.ts';
import { keepPlanImport as keep, loadPlanImport as load, type PlanImportRecord } from './plan-import-record.ts';
import { planToHorizon } from './planning.ts';
import { placeChoice } from './set-meal.ts';
import { shopSchedule } from './shop-schedule.ts';
import { UserError } from './user-error.ts';

/** Past this, a read that never finished died with a restart. */
const READING_LIMIT_MS = 5 * 60 * 1000;
/** A saved import stops being what the screen opens to. */
const SAVED_SHOWS_MS = 24 * 60 * 60 * 1000;
/** More than anyone plans at once, and every day is a page of the review. */
const MOST_DAYS = 62;
const TRY_AGAIN = 'Couldn’t read that plan.';
const NEEDS_KEY = 'Reading a meal plan needs the Anthropic API key in .env.';

export type StartPlanImport = {
  text: string | null;
  photos: Buffer[];
  /** What the form sent. With neither date, it's what the coming trip shops for. */
  from?: string | null;
  through?: string | null;
  claudesIdeas?: boolean;
};

/** The recipes this import can use. With Claude's ideas off, that's the book: picks count once they're kept. */
export function usableRecipes(deps: Deps, claudesIdeas: boolean): Recipe[] {
  const recipes = deps.recipes.list();
  return claudesIdeas ? recipes : recipes.filter(r => !r.claudesPick);
}

function chosenRange(deps: Deps, from: string | null | undefined, through: string | null | undefined, today: ISODate): ImportRange {
  if (!from && !through) return defaultImportRange(today, shopSchedule(deps));
  const start = realDateOrNull(from);
  const end = realDateOrNull(through);
  if (!start || !end) throw new UserError('Choose the days you’re planning.');
  if (end < start) throw new UserError('The last day comes before the first.');
  if (dateRange(start, end).length > MOST_DAYS) throw new UserError('That’s a lot of days. Choose two months at most.');
  return { from: start, through: end };
}

export function planImportView(deps: Deps, now = new Date()): PlanImportView {
  const record = load(deps);
  if (!record) return { status: 'none' };
  const age = now.getTime() - new Date(record.createdAt).getTime();
  const canRetry = record.text !== null && !record.hadPhotos;
  const { id, range, claudesIdeas } = record;
  switch (record.status) {
    case 'reading': return age > READING_LIMIT_MS
      ? { status: 'failed', id, error: 'That took too long.', canRetry }
      : { status: 'reading', id };
    case 'failed': return { status: 'failed', id, error: record.error, canRetry };
    case 'ready': return { status: 'ready', id, meals: record.meals, range, claudesIdeas };
    case 'saved': return age > SAVED_SHOWS_MS ? { status: 'none' } : { status: 'saved', id, saved: record.saved, leftAlone: record.leftAlone, claudesIdeas };
  }
}

/** Starts reading a plan and answers straight away. Anything earlier that wasn't confirmed is dropped. */
export function startPlanImport(deps: Deps, input: StartPlanImport, today: ISODate): string {
  if (!deps.ai.available()) throw new UserError(NEEDS_KEY, 503);
  const text = input.text?.trim() || null;
  if (!text && !input.photos.length) throw new UserError('Add a photo of the plan, or type it in.');
  const range = chosenRange(deps, input.from, input.through, today);
  const id = crypto.randomUUID();
  const record: PlanImportRecord = { id, createdAt: new Date().toISOString(), text, hadPhotos: input.photos.length > 0, range, claudesIdeas: input.claudesIdeas ?? true, status: 'reading' };
  keep(deps, record);
  void readPlan(deps, record, input.photos, today);
  return id;
}

/** Only words can be read again, since photos aren't kept. */
export function retryPlanImport(deps: Deps, today: ISODate): void {
  if (!deps.ai.available()) throw new UserError(NEEDS_KEY, 503);
  const record = load(deps);
  if (record?.status !== 'failed' && record?.status !== 'reading') throw new UserError('There’s nothing to read again.', 409);
  if (record.hadPhotos || !record.text) throw new UserError('Add the photo again to read it.', 409);
  const again: PlanImportRecord = { id: record.id, createdAt: new Date().toISOString(), text: record.text, hadPhotos: false, range: record.range, claudesIdeas: record.claudesIdeas, status: 'reading' };
  keep(deps, again);
  void readPlan(deps, again, [], today);
}

export function discardPlanImport(deps: Deps): void {
  keep(deps, null);
}

async function readPlan(deps: Deps, record: PlanImportRecord, photos: Buffer[], today: ISODate): Promise<void> {
  const { id, text, range, claudesIdeas } = record;
  try {
    const recipes = usableRecipes(deps, claudesIdeas);
    const images = await Promise.all(photos.map(p => deps.photos.forModel(p)));
    const said = await deps.ai.readMealPlan({ text, images }, { today, range, recipes: recipes.map(r => ({ slug: r.slug, title: r.title, tags: r.tags })) });
    const meals = checkedMeals(said, recipes, range);
    if (!meals.length) throw new UserError('We couldn’t find any meals in that. Try a clearer photo, or type it in.');
    finishRead(deps, id, { status: 'ready', meals });
  } catch (e) {
    deps.log(`a meal plan couldn't be read: ${(e as Error).message}`);
    finishRead(deps, id, { status: 'failed', error: e instanceof UserError ? e.message : TRY_AGAIN });
  }
}

/** A newer import, or someone discarding this one, wins over a read that was still going. */
function finishRead(deps: Deps, id: string, result: { status: 'ready'; meals: ImportedMeal[] } | { status: 'failed'; error: string }): void {
  const record = load(deps);
  if (record?.id !== id || record.status !== 'reading') return;
  const { createdAt, text, hadPhotos, range, claudesIdeas } = record;
  keep(deps, { id, createdAt, text, hadPhotos, range, claudesIdeas, ...result });
}

/**
 * Saves what a person looked over, all of it or none, and as chosen by them: pinned, so nothing
 * replaces it on its own. A meal already made stays as it was, and so does a day that's gone by.
 */
export function confirmPlanImport(deps: Deps, id: string, placements: readonly ImportPlacement[], today: ISODate): void {
  deps.unitOfWork.run(() => {
    const record = load(deps);
    if (record?.id !== id || record.status !== 'ready') throw new UserError('That plan was already saved, or a newer one took its place.', 409);
    if (clashingSlots(placements).size) throw new UserError('Two meals are set for the same slot. Choose one first.');
    resumeAutomaticPlanning(deps);
    let saved = 0;
    let leftAlone = 0;
    for (const { date, slot, match } of placements) {
      if (date < today) { leftAlone++; continue; }
      if (match.kind === 'recipe' && !record.claudesIdeas && deps.recipes.get(match.slug)?.claudesPick) {
        throw new UserError('That’s one of Claude’s ideas, and this plan is only using your recipes.');
      }
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
    const { hadPhotos, range, claudesIdeas } = record;
    keep(deps, { id, createdAt: new Date().toISOString(), text: null, hadPhotos, range, claudesIdeas, status: 'saved', saved, leftAlone });
  });
}

/** "Fill in the rest" after a save, held to the choice made when the import started. */
export async function fillAfterPlanImport(deps: Deps, today: ISODate): Promise<number> {
  const record = load(deps);
  if (record?.status !== 'saved') throw new UserError('That plan isn’t saved yet.', 409);
  return (await planToHorizon(deps, today, record.claudesIdeas ? {} : { bookOnly: true })).added;
}
