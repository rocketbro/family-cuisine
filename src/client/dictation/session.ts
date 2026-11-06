// One dictation session, which may be several takes (each up to 10 minutes). It's written to
// localStorage at every step, so a reload or a crash mid-way comes back with Retry instead
// of losing what was said.
import type { ListenContext } from '../../shared/api-types.ts';
import type { WaitingNote } from './ownership.ts';

export type Take = {
  localId: string;
  /** Set once the server has the recording; until then it lives in the phone's IndexedDB. */
  recordingId: string | null;
  seconds: number;
  text: string | null;
};

export type Session = {
  context: ListenContext;
  label: string;
  /** The words go into a text field rather than to the model. */
  toField: boolean;
  /** Which field, so its words can find it again. Sessions saved before fields had names have none. */
  field?: string;
  takes: Take[];
  /** Whether the person said they're done (vs. a take that ended by itself). */
  finishing: boolean;
};

const KEY = 'cuisine.dictation.session';
const WAITING_KEY = 'cuisine.dictation.waiting';

export const savedSession = {
  load(): Session | null {
    try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null; } catch { return null; }
  },
  save(session: Session | null) {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  },
};

/** Typed notes waiting for the session ahead of them to finish. */
export const savedWaiting = {
  load(): WaitingNote[] {
    try { return JSON.parse(localStorage.getItem(WAITING_KEY) ?? '[]') as WaitingNote[]; } catch { return []; }
  },
  save(notes: WaitingNote[]) {
    if (notes.length) localStorage.setItem(WAITING_KEY, JSON.stringify(notes));
    else localStorage.removeItem(WAITING_KEY);
  },
};

export function allWords(session: Pick<Session, 'takes'>): string {
  return session.takes.map(t => t.text?.trim()).filter(Boolean).join('\n\n');
}
