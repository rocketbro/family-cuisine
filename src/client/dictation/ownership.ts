// Who holds the dictation bar, and what a new request may do about it. There's one session at
// a time, and replacing one deletes its audio, so nothing replaces unfinished work: the person
// decides on the bar (Retry, Done, or the two-tap throw away). A mic tap meanwhile does nothing,
// because a mic can't sensibly switch on later. Typed notes have nothing left to say, so they
// wait in line and go when the bar comes free, with no question to answer.
import type { ListenContext } from '../../shared/api-types.ts';
import type { Session } from './session.ts';
import type { DictationPhase } from './useDictation.ts';

export type Ownership = {
  phase: DictationPhase;
  session: Session | null;
  /** The mic has been asked for and hasn't answered yet. */
  starting: boolean;
};

export type Occupant = 'none' | 'listening' | 'working' | 'unfinished';

export type WaitingNote = { text: string; context: ListenContext; label: string };

export function occupant({ phase, session, starting }: Ownership): Occupant {
  if (starting || phase === 'listening') return 'listening';
  if (phase === 'working') return 'working';
  if (session?.takes.length) return 'unfinished';
  return 'none';
}

export function micDecision(holder: Occupant): 'begin' | 'refuse' {
  return holder === 'none' ? 'begin' : 'refuse';
}

export function typedDecision(holder: Occupant): 'begin' | 'wait' {
  return holder === 'none' ? 'begin' : 'wait';
}

/** The note to send now, if any. A mic that failed to start stays on screen until it's dismissed. */
export function nextInLine(ownership: Ownership, waiting: WaitingNote[]): WaitingNote | null {
  return ownership.phase === 'idle' && occupant(ownership) === 'none' ? waiting[0] ?? null : null;
}

/** Another take belongs to the session on the bar, only once it's stopped and working on nothing. */
export function canKeepGoing(phase: DictationPhase): boolean {
  return phase === 'paused' || phase === 'review';
}

/** A session saved before its first take finished holds no audio, so a reload starts clean. */
export function restoredSession(saved: Session | null): Session | null {
  return saved?.takes.length ? saved : null;
}
