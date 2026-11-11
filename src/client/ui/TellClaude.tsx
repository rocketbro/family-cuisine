// "Tell Claude what to change" on a screen under review: the mic, and where it's offered, a line to
// type the same thing instead. Both go the same way; a typed request that fails says so here.
import { Mic, Send } from 'lucide-react';
import { useState } from 'react';

type Props = {
  asking: boolean;
  /** Words are on their way, so another request would trip over them. */
  underway: boolean;
  /** Another dictation's holding the bar. */
  free: boolean;
  listen: () => void;
  /** Leave out to offer only the mic. Throws when Claude couldn't do it. */
  type?: (words: string) => Promise<unknown>;
};

export function TellClaude({ asking, underway, free, listen, type }: Props) {
  const [words, setWords] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const send = async () => {
    if (!type || !words.trim()) return;
    setProblem(null);
    try {
      await type(words.trim());
      setWords('');
    } catch (e) {
      setProblem((e as Error).message);
    }
  };

  return (
    <>
      <button className="button quiet wide" disabled={underway || !free} onClick={listen}>
        <Mic size={18} /> {asking ? 'Claude’s changing it…' : 'Tell Claude what to change'}
      </button>
      {type && (
        <form className="form-with-button tell-claude-typed" onSubmit={e => { e.preventDefault(); void send(); }}>
          <input className="field" aria-label="Or type what to change" placeholder="Or type it here" value={words} disabled={asking}
            onChange={e => setWords(e.target.value)} />
          {words.trim() && <button className="button" disabled={underway}><Send size={16} /> Send</button>}
        </form>
      )}
      {problem && <p className="error small" role="alert">{problem}</p>}
    </>
  );
}
