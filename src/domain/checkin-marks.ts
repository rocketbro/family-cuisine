// One meal marked at the check-in, one tap at a time. Tapping again changes it, so each mark starts
// over from what was planned.
import { cookedSlug, type PlanEntry } from './plan.ts';

export type MealMark = { outcome: 'made' } | { outcome: 'skipped' } | { outcome: 'other'; name: string };

/** Typed in place of the plan: nothing in the book, so nothing to take off the pantry. */
export function ateSomethingElse(entry: Pick<PlanEntry, 'outcome' | 'outcomeSlug'>): boolean {
  return entry.outcome === 'swapped' && entry.outcomeSlug === null;
}

/** `plannedNote` is what the entry's note says when no typed name is standing in it. */
export function withMealMark(entry: PlanEntry, mark: MealMark, plannedNote: string | null): PlanEntry {
  const next: PlanEntry = mark.outcome === 'other'
    ? { ...entry, outcome: 'swapped', outcomeSlug: null, note: mark.name }
    : { ...entry, outcome: mark.outcome, outcomeSlug: null, note: plannedNote };
  // Swaps belong to the dish they were chosen for.
  return cookedSlug(next) === cookedSlug(entry) ? next : { ...next, substituted: null };
}
