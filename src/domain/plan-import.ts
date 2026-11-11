// A meal plan someone wrote out themselves, as read off a photo or from their words, for a stretch
// of days they chose first. Every meal ends up with a real date, or none until someone gives it one.
import { addDays, dateRange, type ISODate } from './dates.ts';
import type { MealSlot } from './recipe.ts';
import { nextTrip, tripCoversThrough, type ShopSchedule } from './shop-schedule.ts';

export type ImportSlot = MealSlot | 'extra';
export type ImportConfidence = 'sure' | 'likely' | 'unsure';

/** What a line of the plan became: a recipe in the book, a meal that's only a name, or leftovers. */
export type ImportMatch =
  | { kind: 'recipe'; slug: string; title: string }
  | { kind: 'named'; name: string }
  | { kind: 'leftovers' };

export type ImportedMeal = {
  /** Their words for it. */
  said: string;
  date: ISODate | null;
  slot: ImportSlot;
  match: ImportMatch;
  confidence: ImportConfidence;
};

export type ImportPlacement = { date: ISODate; slot: ImportSlot; match: ImportMatch };

/** The days someone says they're planning. Meals can land past the end of it. */
export type ImportRange = { from: ISODate; through: ISODate };

/** What the coming grocery trip shops for: the trip through the day before the one after it. */
export function defaultImportRange(today: ISODate, schedule: ShopSchedule): ImportRange {
  const from = nextTrip(today, schedule);
  return { from, through: tripCoversThrough(from, schedule) };
}

/** A from date moved past the end keeps the stretch as long as it was. */
export function withFrom(range: ImportRange, from: ISODate): ImportRange {
  if (from <= range.through) return { from, through: range.through };
  return { from, through: addDays(from, dateRange(range.from, range.through).length - 1) };
}

/** A through date before the start ends it on the start. */
export function withThrough(range: ImportRange, through: ISODate): ImportRange {
  return { from: range.from, through: through < range.from ? range.from : through };
}

export function importedTitle({ match }: Pick<ImportedMeal, 'match'>): string {
  if (match.kind === 'recipe') return match.title;
  return match.kind === 'leftovers' ? 'Leftovers' : match.name;
}

/** What a review would save: meals with a day that hasn't passed. */
export function placementsToSave(meals: readonly ImportedMeal[], today: ISODate): ImportPlacement[] {
  return meals.flatMap(({ date, slot, match }) => (date && date >= today ? [{ date, slot, match }] : []));
}

/** The meal slots more than one line landed on. A slot holds one meal; extras can pile up. */
export function clashingSlots(placements: readonly Pick<ImportPlacement, 'date' | 'slot'>[]): Set<string> {
  const seen = new Set<string>();
  const clashes = new Set<string>();
  for (const { date, slot } of placements) {
    if (slot === 'extra') continue;
    const key = `${date}:${slot}`;
    if (seen.has(key)) clashes.add(key);
    seen.add(key);
  }
  return clashes;
}
