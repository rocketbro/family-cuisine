// "Tell Claude what to change" on something under review: field dictation whose words go to Claude
// with what's on screen, not into a text box, and the same for typed words. The words and audio stay
// on the bar until the answer is in. If the screen has closed by then, the bar holds them, and they
// go through again when the same field offers itself. A failure lands on the bar's Retry.
import { useEffect, useRef, useState } from 'react';
import type { FieldLanding } from './field-words.ts';
import { useDictation } from './useDictation.ts';
import { useFieldDictation } from './useFieldDictation.ts';

type Options<T> = {
  /** Names the field, so words finished after it's gone can find it again. */
  field: string;
  /** What the bar says the words are for. */
  label: string;
  /** Sends the words with what's on screen now. */
  ask: (said: string) => Promise<T>;
  /** Puts the answer on screen. Called only while the screen is still there. */
  onAnswer: (answer: T) => void;
  /** False until the field can take words, as when Claude isn't available yet. */
  ready?: boolean;
};

export function useClaudeRevision<T>({ field, label, ask, onAnswer, ready = true }: Options<T>) {
  const dictation = useDictation();
  const [asking, setAsking] = useState(false);
  const closed = useRef(false);
  useEffect(() => {
    closed.current = false;
    return () => { closed.current = true; };
  }, []);

  /** Words, said or typed, to Claude. Throws if Claude couldn't do it. */
  const take = async (said: string): Promise<FieldLanding> => {
    setAsking(true);
    try {
      const answer = await ask(said);
      if (closed.current) return 'gone';
      onAnswer(answer);
      return 'in';
    } catch (e) {
      if (closed.current) return 'gone';
      throw e;
    } finally {
      setAsking(false);
    }
  };
  const listen = useFieldDictation(field, label, take, ready);

  const mine = dictation.heldField === field;
  return {
    listen,
    take,
    /** With Claude now, so changes made meanwhile would be written over. */
    asking,
    /** Words on their way. Saving now would leave them behind. */
    underway: asking || (mine && ['listening', 'working', 'paused'].includes(dictation.phase)),
    /** Another dictation's unfinished, so the mic can't start. Its label, to say so. */
    heldBy: dictation.holding && !mine ? dictation.holding : null,
    micFree: !dictation.holding,
  };
}
