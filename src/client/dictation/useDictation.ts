// The app-wide dictation session, for any screen that wants a mic button.
import { createContext, useContext } from 'react';
import type { ListenContext } from '../../shared/api-types.ts';
import type { FieldTaker } from './field-words.ts';

/**
 * paused: a take ended by itself (time limit, interruption); failed: a step failed, the audio is safe;
 * words: a field's words are ready but its screen is gone, so the bar holds them.
 */
export type DictationPhase = 'idle' | 'listening' | 'working' | 'paused' | 'failed' | 'words' | 'review' | 'error';

export type Dictation = {
  phase: DictationPhase;
  /** The label of an unfinished session holding the bar, or null when it's free. */
  holding: string | null;
  /** Which text field the session on the bar is for, if it's for one. */
  heldField: string | null;
  /** Start listening. The label says what it's for ("Pantry", "Tonight's dinner"). Does nothing while something else holds the bar. */
  start: (context: ListenContext, label: string) => Promise<void>;
  /** Send typed words instead of a recording. While something else holds the bar they wait their turn. */
  send: (text: string, context: ListenContext, label: string) => Promise<void>;
  /** Listen for a named text field; use it through useFieldDictation. Does nothing while something else holds the bar. */
  dictate: (field: string, label: string) => Promise<void>;
  /** A text field says it's on screen and can take words. Returns how to say it's gone. */
  offerField: (field: string, into: FieldTaker) => () => void;
};

export const DictationContext = createContext<Dictation | null>(null);

export function useDictation(): Dictation {
  const value = useContext(DictationContext);
  if (!value) throw new Error('useDictation outside DictationProvider');
  return value;
}

