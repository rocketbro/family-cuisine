// Text a person left among the ingredients. It isn't parsed or shown, but it's theirs, so an
// edit, which writes the ingredient list afresh, has to carry it along.
import { parseIngredientLine } from './ingredient.ts';
import { groupHeading, isBulletLine, isIngredientsHeading, sectionHeading } from './recipe.ts';

/** One run of lines, and the "### group" it sat under. */
export type IngredientNote = { group: string | null; text: string };

export function ingredientNotes(markdown: string): IngredientNote[] {
  const notes: IngredientNote[] = [];
  let inIngredients = false;
  let group: string | null = null;
  let run: string[] = [];
  const endRun = () => {
    if (run.length) notes.push({ group, text: run.join('\n') });
    run = [];
  };

  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const section = sectionHeading(line);
    const heading = groupHeading(line);
    const isIngredient = isBulletLine(line) && parseIngredientLine(line) !== null;
    if (section !== null || heading !== null || isIngredient || !line.trim()) endRun();
    if (section !== null) {
      inIngredients = isIngredientsHeading(section);
      group = null;
    } else if (heading !== null) {
      group = heading;
    } else if (inIngredients && !isIngredient && line.trim()) {
      run.push(line.trimEnd());
    }
  }
  endRun();
  return notes;
}
