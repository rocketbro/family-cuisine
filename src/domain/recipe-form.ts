// The recipe editor's contents as a person sees them, typed text and all, and what counts as a
// change. Spaces and blank lines around the words don't: only what the words say.
import { ingredientsToText } from './recipe-edit.ts';
import { RECIPE_MEALS, type Recipe, type RecipeMeal } from './recipe.ts';

export type RecipeForm = {
  title: string;
  meals: RecipeMeal[];
  /** As typed, so it may not be a number yet. */
  serves: string;
  time: string;
  /** What has to happen the evening before, or empty. */
  nightBefore: string;
  summary: string;
  /** One per line, with "For the sauce:" lines above groups. */
  ingredients: string;
  body: string;
};

export type RecipeFormField = keyof RecipeForm;

export const RECIPE_FORM_FIELDS: readonly RecipeFormField[] = ['title', 'meals', 'serves', 'time', 'nightBefore', 'summary', 'ingredients', 'body'];

export function formFromRecipe(recipe: Pick<Recipe, 'title' | 'meals' | 'serves' | 'time' | 'nightBefore' | 'summary' | 'ingredients' | 'body'>): RecipeForm {
  return {
    title: recipe.title, meals: recipe.meals, serves: String(recipe.serves), time: recipe.time ?? '', nightBefore: recipe.nightBefore ?? '',
    summary: recipe.summary, ingredients: ingredientsToText(recipe.ingredients), body: recipe.body,
  };
}

/** The lines that say something, without list markers or the spaces around them. */
export function ingredientLines(text: string): string[] {
  return text.split('\n').map(line => line.replace(/^\s*[-*]\s+/, '').trim()).filter(Boolean);
}

export function sameMeals(a: readonly RecipeMeal[], b: readonly RecipeMeal[]): boolean {
  return RECIPE_MEALS.every(meal => a.includes(meal) === b.includes(meal));
}

/** Text that reads the same: differences in line endings, and in spaces at the ends of lines, don't count. */
export function sameText(a: string, b: string): boolean {
  const plain = (text: string) => text.replace(/\r\n/g, '\n').split('\n').map(line => line.trimEnd()).join('\n').trim();
  return plain(a) === plain(b);
}

export function sameIngredients(a: string, b: string): boolean {
  const left = ingredientLines(a);
  const right = ingredientLines(b);
  return left.length === right.length && left.every((line, i) => line === right[i]);
}

function sameServes(a: string, b: string): boolean {
  return a.trim() === b.trim() || (a.trim() !== '' && b.trim() !== '' && Number(a) === Number(b));
}

export function changedFields(before: RecipeForm, after: RecipeForm): RecipeFormField[] {
  return RECIPE_FORM_FIELDS.filter(field => {
    switch (field) {
      case 'meals': return !sameMeals(before.meals, after.meals);
      case 'serves': return !sameServes(before.serves, after.serves);
      case 'ingredients': return !sameIngredients(before.ingredients, after.ingredients);
      default: return !sameText(before[field], after[field]);
    }
  });
}

/** Which ingredient lines came in and went out. A line that only moved is in neither. */
export function changedLines(before: string, after: string): { added: string[]; removed: string[] } {
  const was = ingredientLines(before);
  const now = ingredientLines(after);
  return { added: now.filter(line => !was.includes(line)), removed: was.filter(line => !now.includes(line)) };
}
