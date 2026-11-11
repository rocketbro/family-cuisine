// Checks what Claude made of a recipe form before anyone sees it. Anything that doesn't fit is
// refused whole, so the form never takes half an answer. What Claude left alone goes back exactly
// as it was sent, so a person's own spacing and odd lines are never tidied, or held against it.
import type { PantryMatch } from './pantry-other-names.ts';
import { isGroupLine, readsAsIngredient } from './ingredient-line-check.ts';
import { cleanNightBefore, nightBeforeRefused } from './night-before.ts';
import { ingredientLines, sameIngredients, sameMeals, sameText, type RecipeForm } from './recipe-form.ts';
import { isIngredientsHeading, RECIPE_MEALS, sectionHeading, type RecipeMeal } from './recipe.ts';

/** What the model returns for a form: the same fields, and a line on what it did. */
export type SaidRevision = {
  understood: boolean;
  note: string;
  title: string;
  meals: RecipeMeal[];
  /** Null when the form's own number stands, as when it isn't a number yet. */
  serves: number | null;
  time: string | null;
  /** What has to happen the evening before. Null when nothing does. */
  nightBefore: string | null;
  summary: string;
  ingredients: string[];
  body: string;
  /** The ingredients of the answer that are pantry items, by exact pantry name. */
  pantryMatches: PantryMatch[];
};

/** What a recipe may hold, the same limits a save has to meet. */
const LONGEST = { title: 200, time: 100, summary: 5000, ingredients: 20000, body: 50000 };
const MOST_SERVES = 100;
const REFUSED = 'so nothing changed.';

export function checkRevision(sent: RecipeForm, said: SaidRevision): { form: RecipeForm } | { problem: string } {
  const title = said.title.trim();
  if (!title) return { problem: `Claude left the recipe with no name, ${REFUSED}` };
  if (title.length > LONGEST.title) return { problem: `Claude’s name for the recipe is too long, ${REFUSED}` };

  if (said.serves !== null && !(said.serves > 0 && said.serves <= MOST_SERVES)) return { problem: `Claude’s number of servings doesn’t make sense, ${REFUSED}` };

  const time = said.time?.trim() ?? '';
  if (time.length > LONGEST.time) return { problem: `Claude’s time for the recipe is too long, ${REFUSED}` };

  const nightBefore = said.nightBefore?.trim() ?? '';
  const keptStep = sameText(sent.nightBefore, nightBefore);
  if (!keptStep && nightBeforeRefused(nightBefore)) return { problem: `Claude’s night-before step isn’t one short line of plain words, ${REFUSED}` };

  if (said.summary.length > LONGEST.summary) return { problem: `Claude’s description is too long, ${REFUSED}` };
  if (hasSection(said.summary)) return { problem: `Claude put a heading in the description, which would break up the recipe, ${REFUSED}` };

  const lines = ingredientLines(said.ingredients.join('\n'));
  if (!lines.some(line => !isGroupLine(line))) return { problem: `Claude left the recipe with no ingredients, ${REFUSED}` };
  const known = new Set(ingredientLines(sent.ingredients));
  const unreadable = lines.find(line => !known.has(line) && !readsAsIngredient(line));
  if (unreadable) return { problem: `Claude wrote an ingredient the pantry can’t read (“${unreadable}”), ${REFUSED}` };
  const ingredients = lines.join('\n');
  if (ingredients.length > LONGEST.ingredients) return { problem: `Claude’s ingredient list is too long, ${REFUSED}` };

  if (said.body.length > LONGEST.body) return { problem: `Claude’s steps are too long, ${REFUSED}` };
  if (!said.body.trim() && sent.body.trim()) return { problem: `Claude took out all the steps, ${REFUSED}` };
  if (said.body.split('\n').some(line => isIngredientsHeading(sectionHeading(line) ?? ''))) {
    return { problem: `Claude put a second ingredient list in the steps, ${REFUSED}` };
  }

  const meals = RECIPE_MEALS.filter(meal => said.meals.includes(meal));
  return {
    form: {
      title: sameText(sent.title, title) ? sent.title : title,
      meals: !meals.length || sameMeals(sent.meals, meals) ? sent.meals : meals,
      serves: said.serves === null || Number(sent.serves) === said.serves ? sent.serves : String(said.serves),
      time: sameText(sent.time, time) ? sent.time : time,
      nightBefore: keptStep ? sent.nightBefore : cleanNightBefore(nightBefore) ?? '',
      summary: sameText(sent.summary, said.summary) ? sent.summary : said.summary.trim(),
      ingredients: sameIngredients(sent.ingredients, ingredients) ? sent.ingredients : ingredients,
      body: sameText(sent.body, said.body) ? sent.body : said.body.trim(),
    },
  };
}

function hasSection(text: string): boolean {
  return text.split('\n').some(line => sectionHeading(line) !== null);
}
