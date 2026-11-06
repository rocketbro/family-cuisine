// Converts between recipe files on disk and the domain's Recipe.
import { formatIngredientLine, type Ingredient } from '../../../domain/ingredient.ts';
import { cleanNightBefore } from '../../../domain/night-before.ts';
import { ingredientNotes, type IngredientNote } from '../../../domain/ingredient-notes.ts';
import { bodyWithHeading, type RecipeEdit } from '../../../domain/recipe-edit.ts';
import { groupIngredients, parseRecipeBody, RECIPE_MEALS, type Recipe, type RecipeMeal, type RecipeImage, type RecipeMeta, type RecipeSource } from '../../../domain/recipe.ts';
import { normalSeasons, type Season } from '../../../domain/seasons.ts';
import type { RecipeDraft } from '../../application/ports/recipes.ts';
import { readRecipeFile, writeRecipeFile } from './recipe-frontmatter.ts';

export function parseRecipeFile(slug: string, text: string): Recipe {
  const { data, content } = readRecipeFile(text);
  const meta: RecipeMeta = {
    title: String(data.title ?? slug),
    kind: data.kind === 'simple' ? 'simple' : 'recipe',
    meals: (Array.isArray(data.meals) ? data.meals : [data.meals]).filter((m: unknown): m is RecipeMeal => RECIPE_MEALS.includes(m as RecipeMeal)),
    serves: Number(data.serves) > 0 ? Number(data.serves) : 4,
    time: data.time ? String(data.time) : null,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    batch: data.batch === true,
    seasons: Array.isArray(data.seasons) ? normalSeasons(data.seasons) : [],
    source: readSource(data.source),
    image: readImage(data.image),
    claudesPick: data.claudes_pick === true,
    nightBefore: cleanNightBefore(data.night_before),
  };
  return { slug, ...meta, ...parseRecipeBody(content) };
}

function readSource(value: unknown): RecipeSource | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  return source.name ? { name: String(source.name), url: source.url ? String(source.url) : null } : null;
}

function readImage(value: unknown): RecipeImage | null {
  if (!value || typeof value !== 'object') return null;
  const image = value as Record<string, string>;
  if (image.kind === 'photo' && image.file) return { kind: 'photo', file: image.file };
  if (image.kind === 'unsplash' && image.url) {
    return { kind: 'unsplash', url: image.url, thumbUrl: image.thumbUrl ?? image.url, credit: image.credit ?? '', creditUrl: image.creditUrl ?? '' };
  }
  return null;
}

export function serializeDraft(draft: RecipeDraft): string {
  const front: Record<string, unknown> = {
    title: draft.title,
    kind: draft.kind,
    meals: draft.meals,
    serves: draft.serves,
    ...(draft.time ? { time: draft.time } : {}),
    ...(draft.nightBefore ? { night_before: draft.nightBefore } : {}),
    tags: draft.tags,
    batch: draft.batch,
    ...(normalSeasons(draft.seasons).length ? { seasons: normalSeasons(draft.seasons) } : {}),
    ...(draft.source ? { source: draft.source.url ? draft.source : { name: draft.source.name } } : {}),
    ...(draft.image ? { image: draft.image } : {}),
    ...(draft.claudesPick ? { claudes_pick: true } : {}),
  };
  const sections: string[] = [];
  if (draft.summary.trim()) sections.push(draft.summary.trim());
  sections.push(ingredientSection(draft.ingredients));
  if (draft.steps.length) sections.push(['## Steps', ...draft.steps.map((step, i) => `${i + 1}. ${step.trim()}`)].join('\n'));
  if (draft.notes?.trim()) sections.push(`## Notes\n${draft.notes.trim()}`);
  return writeRecipeFile(`\n${sections.join('\n\n')}\n`, front);
}

function ingredientSection(ingredients: readonly Ingredient[], notes: readonly IngredientNote[] = []): string {
  const groups = groupIngredients(ingredients);
  const names = new Set(groups.map(({ group }) => group));
  const written = new Set<string>();
  const noteLines = (kept: readonly IngredientNote[]) => kept.flatMap(({ text }) => [text, '']);

  // Notes stay with their group; if the edit took the group away, they move to the top.
  const lines = ['## Ingredients', ...noteLines(notes.filter(({ group }) => group === null || !names.has(group)))];
  for (const { group, items } of groups) {
    if (group) {
      if (lines[lines.length - 1] !== '') lines.push('');
      lines.push(`### ${group}`);
      if (!written.has(group)) lines.push(...noteLines(notes.filter(note => note.group === group)));
      written.add(group);
    }
    lines.push(...items.map(formatIngredientLine));
  }
  return lines.join('\n').trimEnd();
}

/** Rewrites what a person edited, keeping the rest of the header as it was. */
export function withEdit(text: string, edit: RecipeEdit): string {
  const { title, meals, serves, time, nightBefore, summary, ingredients, body } = edit;
  const { data, content } = readRecipeFile(text);
  const { time: _time, ...rest } = data;
  if (nightBefore !== undefined) delete rest.night_before;
  const sections = [summary.trim(), ingredientSection(ingredients, ingredientNotes(content)), bodyWithHeading(body)].filter(Boolean);
  return writeRecipeFile(`\n${sections.join('\n\n')}\n`, { ...rest, title, meals, serves, ...(time?.trim() ? { time: time.trim() } : {}), ...(nightBefore ? { night_before: nightBefore } : {}) });
}

/** A Claude's pick joins the regular recipes; the file is otherwise untouched. */
export function withoutPick(text: string): string {
  const parsed = readRecipeFile(text);
  const { claudes_pick: _pick, ...data } = parsed.data;
  return writeRecipeFile(parsed.content, data);
}

/** Rewrites only the frontmatter seasons of an existing file, leaving the body untouched. */
export function withSeasons(text: string, seasons: readonly Season[]): string {
  const parsed = readRecipeFile(text);
  const data = { ...parsed.data };
  const kept = normalSeasons(seasons);
  if (kept.length) data.seasons = kept;
  else delete data.seasons;
  return writeRecipeFile(parsed.content, data);
}

/** Rewrites only the frontmatter image of an existing file, leaving the body untouched. */
export function withImage(text: string, image: RecipeImage | null): string {
  const parsed = readRecipeFile(text);
  const data = { ...parsed.data };
  if (image) data.image = image;
  else delete data.image;
  return writeRecipeFile(parsed.content, data);
}
