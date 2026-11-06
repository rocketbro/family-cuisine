// Goes through the recipes already in the book once, adding a night-before step only where one is
// really needed. A failed batch leaves what's done done, so a retry asks only about what's left.
// A step someone set is never touched: the repository refuses a header that already has one.
import { cleanNightBefore } from '../../domain/night-before.ts';
import { ingredientsToText } from '../../domain/recipe-edit.ts';
import type { Recipe } from '../../domain/recipe.ts';
import type { Deps } from './deps.ts';
import type { NightBeforeQuestion } from './ports/ai.ts';

const RECIPES_PER_REQUEST = 15;
/** Soaking and overnight rises are said early on, and very long recipes are mostly long-winded. */
const LONGEST_METHOD = 3000;
/** Which recipes have had their answer, until the whole run is done. */
const REVIEWED_KEY = 'night_before_reviewed';
/** How many failed runs it takes to give up, so a batch the model keeps failing can't spend forever. */
const MOST_ATTEMPTS = 5;
const ATTEMPTS_KEY = 'night_before_attempts';

export type BackfillResult = { asked: number; added: { slug: string; title: string; step: string }[] };

export async function backfillNightBefore(deps: Deps): Promise<BackfillResult> {
  const result: BackfillResult = { asked: 0, added: [] };
  if (!deps.ai.available()) return result;

  const reviewed = new Set(readReviewed(deps));
  const waiting = deps.recipes.list().filter(recipe => !recipe.nightBefore && !reviewed.has(recipe.slug));
  let failed = false;
  for (let start = 0; start < waiting.length; start += RECIPES_PER_REQUEST) {
    const batch = waiting.slice(start, start + RECIPES_PER_REQUEST);
    try {
      result.added.push(...await reviewBatch(deps, batch));
      result.asked += batch.length;
      for (const recipe of batch) reviewed.add(recipe.slug);
      deps.household.saveSetting(REVIEWED_KEY, JSON.stringify([...reviewed]));
    } catch (error) {
      failed = true;
      deps.log(`night-before: a batch of ${batch.length} failed and stays for the retry: ${(error as Error).message}`);
    }
  }
  if (failed) {
    const attempts = Number(deps.household.setting(ATTEMPTS_KEY) ?? 0) + 1;
    if (attempts < MOST_ATTEMPTS) {
      deps.household.saveSetting(ATTEMPTS_KEY, String(attempts));
      throw new Error('some recipes are still to go through');
    }
    deps.log(`night-before: giving up after ${attempts} tries. A step can still be added by hand on the edit sheet`);
  }
  deps.household.saveSetting(ATTEMPTS_KEY, null);
  deps.household.saveSetting(REVIEWED_KEY, null);
  deps.log(`night-before: went through ${result.asked} recipe(s), added ${result.added.length} step(s)`);
  return result;
}

async function reviewBatch(deps: Deps, batch: readonly Recipe[]): Promise<BackfillResult['added']> {
  const said = await deps.ai.nightBeforeSteps(batch.map(question));
  const added: BackfillResult['added'] = [];
  for (const recipe of batch) {
    const answer = said.find(({ slug }) => slug === recipe.slug);
    if (!answer) continue;
    // The recipe's text may have come from a stranger's page, so the answer is held to what any step is.
    const step = cleanNightBefore(answer.step);
    if (!step) {
      deps.log(`night-before: left out what came back for ${recipe.slug}, which wasn't a short plain line`);
    } else if (deps.recipes.addNightBefore(recipe.slug, step)) {
      deps.log(`night-before: ${recipe.slug}: ${step}`);
      added.push({ slug: recipe.slug, title: recipe.title, step });
    }
  }
  return added;
}

function question(recipe: Recipe): NightBeforeQuestion {
  return { slug: recipe.slug, title: recipe.title, ingredients: ingredientsToText(recipe.ingredients).split('\n'), method: recipe.body.slice(0, LONGEST_METHOD) };
}

function readReviewed(deps: Deps): string[] {
  try {
    const saved: unknown = JSON.parse(deps.household.setting(REVIEWED_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter(slug => typeof slug === 'string') : [];
  } catch {
    return [];
  }
}
