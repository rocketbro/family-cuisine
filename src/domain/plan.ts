// The meal plan: one entry per day and meal, plus what actually happened.
import type { ISODate } from './dates.ts';
import type { MealUse, PlannedDraft } from './drafted-meal.ts';
import type { PlanSlot } from './plan-slot.ts';
import type { MealSlot } from './recipe.ts';
import type { Substitutions } from './substitutes.ts';

/** "recipe" cooks something; "leftovers" eats an earlier batch; "note" is free text ("Pizza night out"). */
export type EntryKind = 'recipe' | 'leftovers' | 'note';

export type Outcome = 'made' | 'swapped' | 'skipped';

export type PlanEntry = {
  date: ISODate;
  slot: PlanSlot;
  kind: EntryKind;
  recipeSlug: string | null;
  multiplier: number;
  leftoversOf: { date: ISODate; slot: MealSlot } | null;
  note: string | null;
  /** Filled in by the evening check-in. */
  outcome: Outcome | null;
  /** When swapped: what was cooked instead (null when it was leftovers or eating out). */
  outcomeSlug: string | null;
  /** True once cook mode's pantry changes for this meal are saved. Until then, the check-in settles it. */
  pantrySettled: boolean;
  /** True once a check-in has been through this meal, so neither a later check-in nor a late cook review takes it off again. */
  checkinSettled: boolean;
  /** The swaps chosen when it was cooked, so the check-in takes off what was actually used. */
  substituted: Substitutions | null;
  /** Chosen by a person (a swap, "Plan this"), not the planner. Never replaced automatically. */
  pinned: boolean;
  /** Put together by the model from what's on hand: how it goes, and what it expects to use. */
  drafted: PlannedDraft | null;
};

/** The smallest whole-or-half batch that makes this many adult portions. Never less than one batch. */
export function portionsMultiplier(serves: number, portions: number): number {
  if (serves <= 0) return 1;
  return Math.max(1, Math.ceil((portions / serves) * 2 - 1e-9) / 2);
}

export function entryKey(entry: { date: ISODate; slot: PlanSlot }): string {
  return `${entry.date}:${entry.slot}`;
}

export function blankEntry(date: ISODate, slot: PlanSlot): PlanEntry {
  return {
    date, slot, kind: 'note', recipeSlug: null, multiplier: 1, leftoversOf: null, note: null, outcome: null,
    outcomeSlug: null, pantrySettled: false, checkinSettled: false, substituted: null, pinned: false, drafted: null,
  };
}

/** Leftovers nobody has eaten yet of meals coming off the plan. */
export function leftoversOfRemoved(entries: readonly PlanEntry[], removed: readonly PlanEntry[]): PlanEntry[] {
  const gone = new Set(removed.map(entryKey));
  return entries.filter(e => !e.outcome && e.leftoversOf && gone.has(entryKey(e.leftoversOf)));
}

/** Leftovers whose dinner changed. They stay as plain leftovers, because what replaced it isn't what they were. */
export function withoutSource(entry: PlanEntry): PlanEntry {
  return { ...entry, leftoversOf: null };
}

/** No outcome, and nothing came off the pantry for it: unticking a meal doesn't put back what it used. */
export const stillOnlyPlanned = (entry: PlanEntry) => !entry.outcome && !entry.pantrySettled && !entry.checkinSettled;

/** The recipe that was (or will be) cooked for an entry, after any swap. */
export function cookedSlug(entry: PlanEntry): string | null {
  if (entry.outcome === 'skipped') return null;
  if (entry.outcome === 'swapped') return entry.outcomeSlug;
  return entry.kind === 'recipe' ? entry.recipeSlug : null;
}

/** Checking a meal off, or changing your mind. */
export function withMealDone(entry: PlanEntry, done: boolean): PlanEntry {
  if (!done) return { ...entry, outcome: null, outcomeSlug: null, substituted: null };
  return entry.outcome === 'made' || entry.outcome === 'swapped' ? entry : { ...entry, outcome: 'made', outcomeSlug: null };
}

/** Which meal a time of day belongs to, for "we just made this" when nothing says which. */
export function slotForHour(hour: number): MealSlot {
  if (hour < 10.5) return 'breakfast';
  if (hour < 15) return 'lunch';
  return 'dinner';
}

/**
 * Records that a recipe was cooked for a meal. Cooking what was planned is "made";
 * cooking anything else is a swap, at the size it was actually cooked. The pantry isn't touched
 * yet, so a different dish isn't settled, whatever the last one was.
 */
export function cookedEntry(planned: PlanEntry, slug: string, multiplier: number, substituted: Substitutions | null = null): PlanEntry {
  const asPlanned = planned.kind === 'recipe' && planned.recipeSlug === slug;
  const sameDish = cookedSlug(planned) === slug;
  return {
    ...planned,
    outcome: asPlanned ? 'made' : 'swapped',
    outcomeSlug: asPlanned ? null : slug,
    multiplier,
    pantrySettled: planned.pantrySettled && sameDish,
    checkinSettled: planned.checkinSettled && sameDish,
    substituted: substituted && Object.keys(substituted).length ? substituted : null,
  };
}

/** A check-in already took this dish off, so a cook review of it has nothing left to change. */
export function settledByCheckin(entry: PlanEntry | null, slug: string): boolean {
  return entry !== null && entry.checkinSettled && cookedSlug(entry) === slug;
}

/** What actually happened at one meal, as the model understood it. */
export type MealUpdate = {
  date: ISODate; slot: PlanSlot; outcome: Outcome; recipeSlug: string | null; note: string | null;
  /** For a drafted meal that went differently: what it really used. */
  uses?: MealUse[] | null;
};
