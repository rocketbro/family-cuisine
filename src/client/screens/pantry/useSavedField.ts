// A typed field that's honest about what's saved. It saves when it loses focus, on Return, on
// tapping Save, and when it goes away (closing the row or sheet keeps what was typed). Until then
// `dirty` says it isn't saved; "Saved" only shows once the server has it. Tapping elsewhere on an
// iPhone doesn't always take focus away, which is why Save has to be there at all.
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';

type Options = {
  /** Resolves to whether it saved. */
  save: (text: string) => Promise<boolean> | boolean;
  /** What's kept of each keystroke: digits only, say. */
  accept?: (text: string) => string;
  /** How the text will read once saved, so "1.50" doesn't look unsaved beside a saved 1.5. */
  tidy?: (text: string) => string;
};

export type SavedField = ReturnType<typeof useSavedField>;

const SAVED_SHOWS_MS = 2500;

export function useSavedField(value: string, { save, accept = t => t, tidy = t => t.trim() }: Options) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  // Fresh data (a dictation, a move, another phone) shows, unless something's being typed over it.
  if (value !== seen) {
    setSeen(value);
    if (draft === seen) setDraft(value);
  }
  const dirty = draft !== value;

  const commit = async () => {
    const text = tidy(draft);
    setDraft(text);
    if (text === value) return;
    setState('saving');
    setState(await save(text) ? 'saved' : 'failed');
  };

  const leaving = useRef(commit);
  useEffect(() => { leaving.current = commit; });
  useEffect(() => () => { void leaving.current(); }, []);

  useEffect(() => {
    if (state !== 'saved') return;
    const timer = setTimeout(() => setState('idle'), SAVED_SHOWS_MS);
    return () => clearTimeout(timer);
  }, [state]);

  return {
    dirty,
    state,
    commit,
    input: {
      value: draft,
      onChange: (e: ChangeEvent<HTMLInputElement>) => { setDraft(accept(e.target.value)); setState('idle'); },
      onBlur: () => void commit(),
      onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } },
    },
  };
}
