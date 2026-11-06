// What a planning run may actually put on the plan once it's done thinking.
import { addDays, type ISODate } from './dates.ts';
import { cookedSlug, entryKey, type PlanEntry } from './plan.ts';

/** Leftovers keep this long; the planner is asked for the same. */
const LEFTOVERS_KEEP_DAYS = 2;

/**
 * Only slots that are still open: whatever a person did while the run was thinking stands. Leftovers
 * must be of a meal that gets cooked, shortly before, and not of a dinner this run lost its slot for.
 */
export function plannedToCommit(planned: readonly PlanEntry[], current: readonly PlanEntry[], history: readonly PlanEntry[]): PlanEntry[] {
  const taken = new Set(current.map(entryKey));
  const open = planned.filter(e => !taken.has(entryKey(e)));
  const lost = new Set(planned.filter(e => taken.has(entryKey(e))).map(entryKey));
  const known = new Map([...history, ...current, ...open].map(e => [entryKey(e), e]));
  return open.filter(e => {
    if (e.kind !== 'leftovers') return true;
    if (!e.leftoversOf || lost.has(entryKey(e.leftoversOf))) return false;
    return leftoversFit(e.date, known.get(entryKey(e.leftoversOf)));
  });
}

function leftoversFit(date: ISODate, source: PlanEntry | undefined): boolean {
  return source !== undefined && cookedSlug(source) !== null && source.date < date && date <= addDays(source.date, LEFTOVERS_KEEP_DAYS);
}
