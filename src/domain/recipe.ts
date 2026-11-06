// A recipe is a markdown file with a small frontmatter header. The body keeps the
// sections a cook expects; only "## Ingredients" is parsed, the rest renders as written.
import { parseIngredientLine, type Ingredient } from './ingredient.ts';
import type { Season } from './seasons.ts';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

/** What a recipe is good for: a meal, or `extra`, made on top of the day's meals (a carrot cake). */
export type RecipeMeal = MealSlot | 'extra';
export const RECIPE_MEALS: RecipeMeal[] = [...MEAL_SLOTS, 'extra'];

export const recipeMealLabel = (meal: RecipeMeal): string => (meal === 'extra' ? 'Extras' : meal[0].toUpperCase() + meal.slice(1));

/** The meals a planner may use it for. Only a person ever plans an extra. */
export const plannableMeals = (meals: readonly RecipeMeal[]): MealSlot[] => meals.filter((meal): meal is MealSlot => meal !== 'extra');

/** "recipe" has steps worth reading; "simple" is just the list of what to pull out. */
export type RecipeKind = 'recipe' | 'simple';

export type RecipeSource = { name: string; url: string | null };

export type RecipeImage =
  | { kind: 'unsplash'; url: string; thumbUrl: string; credit: string; creditUrl: string }
  | { kind: 'photo'; file: string };

export type RecipeMeta = {
  title: string;
  kind: RecipeKind;
  meals: RecipeMeal[];
  /** Adult portions one batch makes. The household eats about 4. */
  serves: number;
  time: string | null;
  tags: string[];
  /** Good to double on purpose so the extra becomes another meal. */
  batch: boolean;
  /** When you'd want to eat it. Empty means all year. */
  seasons: Season[];
  source: RecipeSource | null;
  image: RecipeImage | null;
  /** Claude came up with it and it hasn't joined the family's regular recipes yet. */
  claudesPick: boolean;
  /** Has to happen the evening before cooking, like soaking beans. One short line, or null. */
  nightBefore: string | null;
};

export type Recipe = RecipeMeta & {
  slug: string;
  summary: string;
  ingredients: Ingredient[];
  /** Everything after the ingredients (steps, notes), still markdown. */
  body: string;
};

/** The name of a "## Section" line, or null. */
export const sectionHeading = (line: string): string | null => line.match(/^##\s+(.+?)\s*$/)?.[1] ?? null;
export const isIngredientsHeading = (section: string): boolean => /^ingredients$/i.test(section);
/** The group a "### Group" line starts, or null. */
export const groupHeading = (line: string): string | null => line.match(/^###\s+(.+?)\s*$/)?.[1].replace(/:$/, '') ?? null;
export const isBulletLine = (line: string): boolean => /^\s*[-*]\s+/.test(line);

/** Splits the markdown body into summary, ingredients and the remaining sections. */
export function parseRecipeBody(markdown: string): Pick<Recipe, 'summary' | 'ingredients' | 'body'> {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const summary: string[] = [];
  const rest: string[] = [];
  const ingredients: Ingredient[] = [];
  let section: 'summary' | 'ingredients' | 'rest' = 'summary';
  let group: string | null = null;

  for (const line of lines) {
    const h2 = sectionHeading(line);
    if (h2 !== null) {
      section = isIngredientsHeading(h2) ? 'ingredients' : 'rest';
      group = null;
      if (section === 'rest') rest.push(line);
      continue;
    }
    if (section === 'summary') summary.push(line);
    else if (section === 'rest') rest.push(line);
    else {
      const h3 = groupHeading(line);
      if (h3 !== null) group = h3;
      else if (isBulletLine(line)) {
        const parsed = parseIngredientLine(line, group);
        if (parsed) ingredients.push(parsed);
      }
    }
  }
  return { summary: summary.join('\n').trim(), ingredients, body: rest.join('\n').trim() };
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'recipe';
}

export function groupIngredients<T extends Ingredient>(ingredients: readonly T[]): { group: string | null; items: T[] }[] {
  const groups: { group: string | null; items: T[] }[] = [];
  for (const ingredient of ingredients) {
    const last = groups[groups.length - 1];
    if (last && last.group === ingredient.group) last.items.push(ingredient);
    else groups.push({ group: ingredient.group, items: [ingredient] });
  }
  return groups;
}
