// Their own words under a meal's name, only when there's a reason to check it.
import { importedTitle, type ImportedMeal } from '../../../domain/plan-import.ts';

export function ImportMealWords({ meal }: { meal: ImportedMeal }) {
  const unsure = meal.confidence !== 'sure';
  const nameOnly = meal.match.kind === 'named';
  if (!unsure && !nameOnly) return null;
  const sameWords = meal.said.trim().toLowerCase() === importedTitle(meal).trim().toLowerCase();
  const notes = [sameWords ? null : `“${meal.said}”`, unsure ? 'Not sure' : null, nameOnly ? 'No recipe' : null].filter(Boolean);
  return <p className="plan-meal-words">{notes.join(' · ')}</p>;
}
