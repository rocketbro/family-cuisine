// What Claude has done to the form since the sheet opened, so the sheet can say so and take the
// last of it back. Each revision remembers the form as it was just before, hand edits included,
// so only what Claude changed is ever marked.
import { changedFields, changedLines, type RecipeForm, type RecipeFormField } from '../../../domain/recipe-form.ts';

export type Revision = { before: RecipeForm; changed: RecipeFormField[]; note: string };

export function revisionOf(before: RecipeForm, after: RecipeForm, note: string): Revision {
  return { before, changed: changedFields(before, after), note };
}

/** Every field Claude has changed so far. */
export function markedFields(history: readonly Revision[]): Set<RecipeFormField> {
  return new Set(history.flatMap(revision => revision.changed));
}

/** Takes back the last revision. Typing elsewhere since then stays. */
export function withoutLastRevision(form: RecipeForm, history: readonly Revision[]): { form: RecipeForm; history: Revision[] } {
  const last = history.at(-1);
  if (!last) return { form, history: [] };
  const restored = last.changed.reduce<RecipeForm>((next, field) => ({ ...next, [field]: last.before[field] }), form);
  return { form: restored, history: history.slice(0, -1) };
}

/** Ingredient lines that differ from before Claude's first revision. */
export function revisedLines(form: RecipeForm, history: readonly Revision[]): { added: string[]; removed: string[] } {
  return history.length ? changedLines(history[0].before.ingredients, form.ingredients) : { added: [], removed: [] };
}

const FIELD_WORDS: Record<RecipeFormField, string> = {
  title: 'the name', meals: 'what it’s good for', serves: 'the servings', time: 'the time', nightBefore: 'the night-before step',
  summary: 'the description', ingredients: 'the ingredients', body: 'the steps',
};

/** "the time, the ingredients and the steps" */
export function fieldsInWords(fields: readonly RecipeFormField[]): string {
  const words = fields.map(field => FIELD_WORDS[field]);
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}
