// How a recipe call is shown the pantry: each item's name, with the other names it goes by, so the
// model can say which item an ingredient is even when the recipe uses another word for it.
import type { PantryRef } from '../../application/ports/ai.ts';

export function pantryList(pantry: readonly PantryRef[]): string {
  const lines = pantry.map(({ name, alsoCalled }) => (alsoCalled.length ? `- ${name} (also called: ${alsoCalled.join(', ')})` : `- ${name}`));
  return `The pantry. Say which item an ingredient is by its exact name here (pantryName), judging by what it is, not just its words:\n${lines.join('\n') || '(nothing yet)'}`;
}
