// "Any left?" Whether a dinner's leftovers are worth offering. A person's answer beats any guess.
import { cookedSlug, type PlanEntry } from './plan.ts';

export type DinnerLeft = 'some' | 'none';

/** Answers to "Any left?" are kept this long; by then the leftovers are long gone. */
export const KEEP_ANSWERS_DAYS = 14;

/** The question is about a dinner someone ate, and leftovers of leftovers aren't worth asking about. */
export function asksAnyLeft(meals: readonly PlanEntry[]): boolean {
  return meals.some(m => m.slot === 'dinner' && (m.outcome === 'made' || m.outcome === 'swapped') && m.kind !== 'leftovers');
}

/**
 * Whether to offer it as leftovers. A dinner from the book probably left some until someone says not,
 * but a dinner that's only a name might be "Eating out", so that takes a yes.
 */
export function offersLeftovers(entry: PlanEntry, madeTitle: string | null, answer: DinnerLeft | undefined): boolean {
  if (entry.slot !== 'dinner' || !madeTitle) return false;
  if (answer) return answer === 'some';
  return cookedSlug(entry) !== null;
}
