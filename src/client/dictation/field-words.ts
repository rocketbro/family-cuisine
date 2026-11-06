// What becomes of words meant for a text field, and what a reload comes back to. A field can be
// gone by the time its words are ready (the person left the screen, or reloaded), and its audio
// goes only once the words are in. Until then the session holds them, saved like any other step.
import { allWords, type Session } from './session.ts';

export const NOTHING_HEARD = 'We didn’t catch anything. Try again a little closer to the phone.';

export type FieldOutcome = 'land' | 'hold' | 'nothing-heard';

/** Only landing lets the audio go. Hearing nothing keeps it too, in case the transcription is what failed. */
export function fieldOutcome(words: string, fieldOnScreen: boolean): FieldOutcome {
  if (!words) return 'nothing-heard';
  return fieldOnScreen ? 'land' : 'hold';
}

/**
 * What a field says about words it was handed. Most take them on the spot and say nothing. One that
 * has to do something with them first answers once it has: "in", or "gone" if it left meanwhile.
 * A failure throws, with the words not in.
 */
export type FieldLanding = 'in' | 'gone';
export type FieldTaker = (text: string) => void | Promise<FieldLanding>;

export type HandOver = { kind: 'landed' } | { kind: 'held' } | { kind: 'failed'; message: string };

/** The session ends only on 'landed', which waits for the field's own answer. */
export async function handOver(take: FieldTaker, words: string): Promise<HandOver> {
  try {
    return (await take(words)) === 'gone' ? { kind: 'held' } : { kind: 'landed' };
  } catch (e) {
    return { kind: 'failed', message: (e as Error).message };
  }
}

/** Said Done, every take transcribed, and there's something to hand over. */
function wordsAreReady(session: Session): boolean {
  return session.toField && session.finishing && session.takes.every(t => t.text !== null) && allWords(session) !== '';
}

/** Words ready for a field go straight back on the bar; anything else unfinished lands on Retry. */
export function restoredPhase(session: Session | null): 'idle' | 'words' | 'failed' {
  if (!session) return 'idle';
  return wordsAreReady(session) ? 'words' : 'failed';
}

export function restoredMessage(session: Session | null): string | null {
  if (restoredPhase(session) !== 'failed') return null;
  return session!.takes.every(t => t.recordingId === 'typed')
    ? 'A note you typed wasn’t finished. Your words are saved.'
    : 'A dictation wasn’t finished. Your recording is saved.';
}
