// Clearing the plan: what's still only an intention comes off, and everything that happened stays.
import type { ISODate } from './dates.ts';
import { leftoversOfRemoved, stillOnlyPlanned, withoutSource, type PlanEntry } from './plan.ts';

export type ClearedPlan = {
  removed: PlanEntry[];
  /** Kept, but their dinner is going, so they stay as plain leftovers. */
  withoutSource: PlanEntry[];
};

/** Past days are never touched, whatever they hold. */
export function clearedPlan(entries: readonly PlanEntry[], today: ISODate): ClearedPlan {
  const ahead = entries.filter(entry => entry.date >= today);
  const removed = ahead.filter(stillOnlyPlanned);
  const gone = new Set(removed);
  return { removed, withoutSource: leftoversOfRemoved(ahead, removed).filter(entry => !gone.has(entry)).map(withoutSource) };
}
