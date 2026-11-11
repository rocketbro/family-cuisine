// What the tidy-up remembers so it doesn't ask the same thing twice: each fingerprint with the day until which it's left alone.
import { addDays, type ISODate } from './dates.ts';
import { MAX_QUESTIONS_PER_RUN, type PendingQuestion } from './tidy-questions.ts';

/** Asked, answered or dismissed: not asked again for about three months. */
export const ASKED_QUIET_DAYS = 90;
/** Looked at and left alone by the model: looked at again in three weeks, since things change. */
export const PASSED_QUIET_DAYS = 21;
/** A question nobody answers goes away on its own. */
export const PENDING_DAYS = 14;
/** At most this many cards wait at once. */
export const MAX_PENDING = MAX_QUESTIONS_PER_RUN;

export type Quiet = Record<string, ISODate>;

export function stillQuiet(quiet: Quiet, today: ISODate): Quiet {
  return Object.fromEntries(Object.entries(quiet).filter(([, until]) => until > today));
}

export function withQuiet(quiet: Quiet, fingerprints: readonly string[], days: number, today: ISODate): Quiet {
  const until = addDays(today, days);
  return { ...stillQuiet(quiet, today), ...Object.fromEntries(fingerprints.map(f => [f, until])) };
}

export const stillWaiting = (pending: readonly PendingQuestion[], today: ISODate): PendingQuestion[] =>
  pending.filter(p => p.askedOn > addDays(today, -PENDING_DAYS));

export const roomForQuestions = (pending: readonly PendingQuestion[]): number => Math.max(0, MAX_PENDING - pending.length);
