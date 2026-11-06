// What past trips say about the pantry's settings. These are only ever suggestions: a person
// says yes before anything changes.
import type { PantryItem } from './pantry.ts';
import type { TripDiff } from './receipts.ts';

/** How many trips it takes before a habit is worth mentioning. */
export const HABIT_TRIPS = 3;
/** Only recent trips count, because habits change. */
const WINDOW_TRIPS = 8;

export type TripSuggestion = {
  key: string;
  pantryItemId: number;
  name: string;
  kind: 'keep-stocked' | 'as-needed';
  trips: number;
};

/** `trips` are newest first. Dismissed suggestions stay dismissed. */
export function tripSuggestions(trips: readonly TripDiff[], pantry: readonly PantryItem[], dismissed: ReadonlySet<string>): TripSuggestion[] {
  const recent = trips.slice(0, WINDOW_TRIPS);
  const suggestions: TripSuggestion[] = [];
  const consider = (item: PantryItem, kind: TripSuggestion['kind'], times: number) => {
    const key = `${kind}:${item.id}`;
    if (times >= HABIT_TRIPS && !dismissed.has(key)) suggestions.push({ key, pantryItemId: item.id, name: item.name, kind, trips: times });
  };
  for (const item of pantry) {
    if (item.staple) continue;
    if (item.occasional) consider(item, 'keep-stocked', recent.filter(t => t.extras.some(l => l.pantryItemId === item.id)).length);
    // Only plain restocks: skipping something a recipe needed says nothing about keeping it around.
    else consider(item, 'as-needed', recent.filter(t => t.skipped.some(l => l.pantryItemId === item.id && l.reason === 'restock')).length);
  }
  return suggestions;
}
