// A meal plan someone wrote out themselves, as read off a photo or from their words. Plans name
// days far more often than dates, so which week they mean is an assumption, shown and changeable.
import { addDays, dayOfWeek, type ISODate } from './dates.ts';
import type { MealSlot } from './recipe.ts';

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
  /** A date written on the plan, or one a person chose in the review. It stays put when the week changes. */
  date: ISODate | null;
  /** 0 = Sunday. The day it named, which lands in whichever week is assumed. */
  weekday: number | null;
  slot: ImportSlot;
  match: ImportMatch;
  confidence: ImportConfidence;
};

export type ImportPlacement = { date: ISODate; slot: ImportSlot; match: ImportMatch };

/** The date a weekday falls on in the seven days from `start`. */
export function dateInWeek(weekday: number, start: ISODate): ISODate {
  return addDays(start, (weekday - dayOfWeek(start) + 7) % 7);
}

/**
 * The week a plan most likely means, from today on. A date written on it decides. Otherwise it starts
 * on the first day it names, the next time that comes around, because that's how a plan is written:
 * a Monday-to-Friday one made on a Friday isn't starting today. With neither, it starts today.
 */
export function assumedWeekStart(meals: readonly ImportedMeal[], today: ISODate): ISODate {
  const written = meals.flatMap(m => (m.date && m.date >= today ? [m.date] : [])).sort()[0];
  if (written) return written;
  const named = meals.find(m => m.weekday !== null);
  return named ? dateInWeek(named.weekday!, today) : today;
}

export function importedDate(meal: Pick<ImportedMeal, 'date' | 'weekday'>, start: ISODate): ISODate | null {
  return meal.date ?? (meal.weekday === null ? null : dateInWeek(meal.weekday, start));
}

/** What a review would save: meals with a day that hasn't passed. */
export function placementsToSave(meals: readonly ImportedMeal[], start: ISODate, today: ISODate): ImportPlacement[] {
  return meals.flatMap(meal => {
    const date = importedDate(meal, start);
    return date && date >= today ? [{ date, slot: meal.slot, match: meal.match }] : [];
  });
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
