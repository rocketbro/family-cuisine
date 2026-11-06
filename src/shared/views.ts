// The shapes the app's screens receive: types only. The server builds them in `application/recipe-views.ts`.
import type { Availability, IngredientStock } from '../domain/availability.ts';
import type { Ingredient } from '../domain/ingredient.ts';
import type { PlanEntry } from '../domain/plan.ts';
import type { Recipe } from '../domain/recipe.ts';
import type { SubstitutableIngredient, Substitutions } from '../domain/substitutes.ts';

export type RecipeCard = Pick<Recipe, 'slug' | 'title' | 'kind' | 'meals' | 'time' | 'tags' | 'batch' | 'image' | 'serves' | 'seasons' | 'claudesPick' | 'nightBefore'> & {
  summary: string;
  availability: Availability;
};

export type RecipeDetail = RecipeCard & Pick<Recipe, 'source' | 'body'> & {
  /** The working copy: the recipe's ingredients with any chosen swaps put in. */
  ingredients: (Ingredient & { stock: IngredientStock })[];
  /** Swaps on offer for the recipe as written, by ingredient. */
  substitutes: (SubstitutableIngredient & { stock: IngredientStock })[];
  /** The swaps in use; availability above already counts them. */
  substituted: Substitutions;
};

export type PlanEntryView = PlanEntry & { recipe: RecipeCard | null; leftoversTitle: string | null };

/** A recipe file that couldn't be read: a name to show as plain text, and what's wrong in plain words. */
export type RecipeFileNotice = { file: string; problem: string };

/** Says what went wrong when a screen can offer something better than the message. */
export type ProblemCode = 'site-refused';
