// Browsing recipes, their photos, and bringing new ones in from a link or cookbook pages.
import { cleanNightBefore, nightBeforeRefused } from '../../domain/night-before.ts';
import { ingredientsFromText, planWithoutRecipe } from '../../domain/recipe-edit.ts';
import type { Recipe, RecipeImage } from '../../domain/recipe.ts';
import type { Season } from '../../domain/seasons.ts';
import type { Substitutions } from '../../domain/substitutes.ts';
import type { PantryMatch } from '../../domain/pantry-other-names.ts';
import type { Deps } from './deps.ts';
import type { PantryRef } from './ports/ai.ts';
import type { RecipeDraft } from './ports/recipes.ts';
import { addOtherNames } from './recipe-other-names.ts';
import { recipeCard, recipeDetail, recipeFileNotice } from './recipe-views.ts';
import type { RecipeCard, RecipeDetail, RecipeFileNotice } from '../../shared/views.ts';
import { UserError } from './user-error.ts';

export function listRecipes(deps: Deps): RecipeCard[] {
  const pantry = deps.pantry.list();
  return deps.recipes.list().map(r => recipeCard(r, pantry));
}

/** Files that couldn't join the book, in plain words. Reading them runs nothing and changes nothing. */
export function recipeFileProblems(deps: Deps): RecipeFileNotice[] {
  return deps.recipes.problems().map(recipeFileNotice);
}

export function getRecipe(deps: Deps, slug: string, factor = 1, substituted: Substitutions = {}): RecipeDetail | null {
  const recipe = deps.recipes.get(slug);
  return recipe ? recipeDetail(recipe, deps.pantry.list(), factor, substituted) : null;
}

export type RecipeChanges = Pick<Recipe, 'title' | 'meals' | 'serves' | 'time' | 'summary' | 'body'> & {
  ingredients: string; nightBefore?: string | null;
  /** From the last "Tell Claude" answer the form holds, so the names it used can become other names on Save. */
  pantryMatches?: PantryMatch[];
};

export function editRecipe(deps: Deps, slug: string, { pantryMatches, ...changes }: RecipeChanges): void {
  const recipe = deps.recipes.get(slug);
  if (!recipe) throw new UserError('No such recipe.', 404);
  const ingredients = ingredientsFromText(changes.ingredients);
  if (!ingredients.length) throw new UserError('A recipe needs at least one ingredient.');
  deps.recipes.update(slug, { ...changes, ingredients, nightBefore: nightBeforeChange(recipe.nightBefore, changes.nightBefore) });
  addOtherNames(deps, pantryMatches, ingredients);
}

/**
 * Left out or blank where the recipe shows none, it stays as it is, which keeps a hand-written line
 * the app can't show (too long, say) from being wiped by an edit of something else.
 */
function nightBeforeChange(shown: string | null, said: string | null | undefined): string | null | undefined {
  if (said === undefined || (!said?.trim() && !shown)) return undefined;
  if (said !== null && nightBeforeRefused(said)) throw new UserError('Keep the night-before step to one short line, with no links.');
  return cleanNightBefore(said);
}

/** Takes a recipe out of the book and off the plan. Open slots get filled at the next top-up. */
export function deleteRecipe(deps: Deps, slug: string): void {
  const recipe = deps.recipes.get(slug);
  if (!recipe) throw new UserError('No such recipe.', 404);
  const { removed, renamed } = planWithoutRecipe(deps.plan.range('0000-01-01', '9999-12-31'), slug, recipe.title);
  for (const entry of removed) deps.plan.remove(entry.date, entry.slot);
  for (const entry of renamed) deps.plan.upsert(entry);
  if (recipe.image?.kind === 'photo') deps.photos.remove(recipe.image.file);
  deps.recipes.remove(slug);
}

export function setRecipeSeasons(deps: Deps, slug: string, seasons: readonly Season[]): void {
  if (!deps.recipes.get(slug)) throw new UserError('No such recipe.', 404);
  deps.recipes.setSeasons(slug, seasons);
}

export async function setRecipePhoto(deps: Deps, slug: string, photo: Buffer): Promise<void> {
  if (!deps.recipes.get(slug)) throw new UserError('No such recipe.', 404);
  const file = await deps.photos.save(photo, slug);
  replaceImage(deps, slug, { kind: 'photo', file });
}

/** Our own photo belongs to its one recipe, so it goes once the recipe has moved on from it. */
function replaceImage(deps: Deps, slug: string, image: RecipeImage): void {
  const old = deps.recipes.get(slug)?.image;
  deps.recipes.setImage(slug, image);
  if (old?.kind === 'photo') deps.photos.remove(old.file);
}

/** Gives a recipe an Unsplash photo when it has none, or a different one when asked to look again. True if it got one. */
export async function findRecipeImage(deps: Deps, recipe: Pick<Recipe, 'slug' | 'title' | 'image'>, force = false): Promise<boolean> {
  if ((recipe.image && !force) || !deps.images.available()) return false;
  try {
    const image = await deps.images.find(recipe.title, recipe.image?.kind === 'unsplash' ? recipe.image.url : undefined);
    if (!image) return false;
    // The search takes a while, and a photo someone added meanwhile beats one nobody asked for.
    if (!force && deps.recipes.get(recipe.slug)?.image) return false;
    replaceImage(deps, recipe.slug, image);
    return true;
  } catch (error) {
    deps.log(`image search failed for ${recipe.slug}: ${(error as Error).message}`);
    return false;
  }
}

/** Looks for a different photo because someone asked. True if it found one. */
export async function refreshRecipeImage(deps: Deps, slug: string): Promise<boolean> {
  const recipe = deps.recipes.get(slug);
  if (!recipe) throw new UserError('No such recipe.', 404);
  return findRecipeImage(deps, recipe, true);
}

/** `viaClaude` is for a site that blocked us, once the person has said to try that way. */
export async function importFromUrl(deps: Deps, url: string, notes: string | null = null, viaClaude = false): Promise<string> {
  requireModel(deps);
  const page = await (viaClaude ? deps.claudePages : deps.pages).fetch(url);
  const draft = await deps.ai.recipeFromPage(page, pantryRefs(deps), notes);
  return saveImported(deps, { ...draft, source: { name: page.siteName, url: page.url } });
}

export async function importFromPhotos(deps: Deps, photos: Buffer[], sourceName: string | null, notes: string | null = null): Promise<string> {
  requireModel(deps);
  if (!photos.length) throw new UserError('Add at least one photo of the recipe.');
  const images = await Promise.all(photos.map(p => deps.photos.forModel(p)));
  const draft = await deps.ai.recipeFromImages(images, pantryRefs(deps), notes);
  return saveImported(deps, { ...draft, source: sourceName?.trim() ? { name: sourceName.trim(), url: null } : null });
}

export async function importFromWords(deps: Deps, words: string): Promise<string> {
  requireModel(deps);
  if (!words.trim()) throw new UserError('Say or type the recipe first.');
  return saveImported(deps, await deps.ai.recipeFromDescription(words, pantryRefs(deps)));
}

/** A Claude's pick the family likes joins the regular rotation. */
export function keepPick(deps: Deps, slug: string): void {
  if (!deps.recipes.get(slug)) throw new UserError('No such recipe.', 404);
  deps.recipes.keepPick(slug);
}

export async function saveImported(deps: Deps, draft: RecipeDraft): Promise<string> {
  const slug = deps.recipes.save(draft);
  addOtherNames(deps, draft.pantryMatches, draft.ingredients);
  await findRecipeImage(deps, { slug, title: draft.title, image: null });
  return slug;
}

function requireModel(deps: Deps): void {
  if (!deps.ai.available()) throw new UserError('Recipe import needs the Anthropic API key in .env.', 503);
}

/** What every import and revision shows the model to match against. */
export function pantryRefs(deps: Deps): PantryRef[] {
  return deps.pantry.list().map(({ name, alsoCalled }) => ({ name, alsoCalled }));
}
