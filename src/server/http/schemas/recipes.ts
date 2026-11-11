// What a person can change about a recipe.
import { z } from 'zod';
import { RECIPE_MEALS, type RecipeMeal } from '../../../domain/recipe.ts';

const recipeMeal = z.enum(RECIPE_MEALS as [RecipeMeal, ...RecipeMeal[]]);

export const recipeChanges = z.object({
  title: z.string().trim().min(1, 'Give the recipe a name.').max(200),
  meals: z.array(recipeMeal),
  serves: z.number({ error: 'Serves needs to be a number.' }).positive('Serves needs to be above zero.').max(100),
  time: z.string().max(100).nullable(),
  /** Left out by a page loaded before this field existed, which then leaves the step alone. */
  nightBefore: z.string().max(400).nullable().optional(),
  summary: z.string().max(5000),
  ingredients: z.string().max(20000),
  body: z.string().max(50000),
  /** What the last "Tell Claude" answer said the ingredients are in the pantry; checked against the pantry and the saved lines. */
  pantryMatches: z.array(z.object({ written: z.string().max(200), pantryName: z.string().max(200) })).max(200).optional(),
});

/** What someone said about a recipe, and the editor's contents as they stand: typed text, so not yet a valid recipe. */
export const recipeRevision = z.object({
  said: z.string().max(100_000),
  form: z.object({
    title: z.string().max(200),
    meals: z.array(recipeMeal),
    serves: z.string().max(20),
    time: z.string().max(100),
    nightBefore: z.string().max(400).default(''),
    summary: z.string().max(5000),
    ingredients: z.string().max(20000),
    body: z.string().max(50000),
  }),
});
