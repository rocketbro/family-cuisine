// Recipes as the screens receive them: each one judged against the pantry, in plain words.
import { ingredientStock, recipeAvailability } from '../../domain/availability.ts';
import type { PantryItem } from '../../domain/pantry.ts';
import type { Recipe } from '../../domain/recipe.ts';
import { fileNameToShow, RECIPE_FILE_PROBLEM_WORDS, type RecipeFileProblem } from '../../domain/recipe-file-problem.ts';
import { applySubstitutions, substitutesFor, type Substitutions } from '../../domain/substitutes.ts';
import type { RecipeCard, RecipeDetail, RecipeFileNotice } from '../../shared/views.ts';

export function recipeCard(recipe: Recipe, pantry: readonly PantryItem[], factor = 1): RecipeCard {
  return {
    slug: recipe.slug, title: recipe.title, kind: recipe.kind, meals: recipe.meals, time: recipe.time, tags: recipe.tags,
    batch: recipe.batch, seasons: recipe.seasons, image: recipe.image, serves: recipe.serves, summary: recipe.summary, claudesPick: recipe.claudesPick, nightBefore: recipe.nightBefore,
    availability: recipeAvailability(recipe.ingredients, pantry, factor),
  };
}

export function recipeDetail(recipe: Recipe, pantry: readonly PantryItem[], factor = 1, substituted: Substitutions = {}): RecipeDetail {
  const working = applySubstitutions(recipe.ingredients, substituted);
  return {
    ...recipeCard(recipe, pantry, factor),
    availability: recipeAvailability(working, pantry, factor),
    source: recipe.source,
    body: recipe.body,
    ingredients: working.map(ingredient => ({ ...ingredient, stock: ingredientStock(ingredient, pantry, factor) })),
    substitutes: substitutesFor(recipe.ingredients, pantry, factor).map(s => ({ ...s, stock: ingredientStock(s.ingredient, pantry, factor) })),
    substituted,
  };
}

export function recipeFileNotice({ file, kind }: RecipeFileProblem): RecipeFileNotice {
  return { file: fileNameToShow(file), problem: RECIPE_FILE_PROBLEM_WORDS[kind] };
}
