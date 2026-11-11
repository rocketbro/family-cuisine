// Dishes Claude comes up with become real recipes, marked as Claude's picks until the family
// keeps them. Anything built on an existing recipe stays with that meal and never gets here.
import { recipeAvailability } from '../../domain/availability.ts';
import { portionsText } from '../../domain/portions.ts';
import { slugify, type MealSlot, type Recipe } from '../../domain/recipe.ts';
import type { Deps } from './deps.ts';
import { batchFor } from './household-profile.ts';
import { deleteRecipe, pantryRefs, saveImported } from './recipes.ts';
import { UserError } from './user-error.ts';

type PickRequest = {
  title: string;
  /** What's in it, as far as that's been decided. */
  idea: string | null;
  /** Null for an extra, which isn't one of the day's meals. */
  slot: MealSlot | null;
  /** Should come from what's in the house, because nobody is shopping first. */
  fromHouse: boolean;
  /** Leave it out altogether if the written recipe still needs shopping. */
  onlyIfReady?: boolean;
};

/** Dishes being written right now, so the same one is never written twice side by side (a `-2` copy). */
const writing = new Map<string, Promise<unknown>>();

/** The recipe for a dish, written if it's new. Null only when `onlyIfReady` rules it out. */
export async function writePick(deps: Deps, request: PickRequest): Promise<Recipe | null> {
  const slug = slugify(request.title);
  while (writing.has(slug)) await writing.get(slug)!.catch(() => undefined);
  const already = deps.recipes.get(slug);
  if (already) return already;
  const work = writeNew(deps, request).finally(() => writing.delete(slug));
  writing.set(slug, work);
  return work;
}

async function writeNew(deps: Deps, { title, idea, slot, fromHouse, onlyIfReady = false }: PickRequest): Promise<Recipe | null> {
  if (!deps.ai.available()) throw new UserError('Writing a recipe needs the Anthropic API key in .env.', 503);
  const pantry = deps.pantry.list();
  const inHouse = pantry.filter(p => p.status !== 'out' && p.category !== 'Other').map(p => (p.portions.length ? `${p.name} (${portionsText(p.portions)})` : p.name));
  const description = [
    slot ? `${title}, for ${slot}.` : `${title}, something extra to make that day, not one of its meals.`,
    idea,
    fromHouse ? `Nothing gets bought: use only these, and no more than the amounts shown. ${inHouse.join(', ')}.` : null,
  ].filter(Boolean).join('\n');
  const draft = await deps.ai.recipeFromDescription(description, pantryRefs(deps), { invented: true });
  if (onlyIfReady && recipeAvailability(draft.ingredients, pantry, batchFor(deps, draft.serves)).level !== 'ready') {
    deps.log(`left out ${title}: the written recipe needs more than the house has`);
    return null;
  }
  const slug = await saveImported(deps, { ...draft, title, meals: slot ? [...new Set([...draft.meals, slot])] : draft.meals, claudesPick: true });
  return deps.recipes.get(slug);
}

/** "Don't suggest this again." A pick they turned down also comes out of the book and off the plan. */
export function avoidMeal(deps: Deps, title: string, reason: string | null, slug: string | null): void {
  deps.avoided.add(title.trim(), reason?.trim() || null);
  if (slug && deps.recipes.get(slug)?.claudesPick) deleteRecipe(deps, slug);
}
