// Words said elsewhere about this recipe (on a receipt's review), ready to hand to Claude here with
// one tap. Nothing changes until that tap, and nothing saves until Save.
import { Sparkles } from 'lucide-react';
import { useState } from 'react';

export function CarriedWords({ words, asking, disabled, apply }: {
  words: string; asking: boolean; disabled: boolean; apply: (words: string) => Promise<unknown>;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const run = async () => {
    setProblem(null);
    try {
      await apply(words);
    } catch (e) {
      setProblem((e as Error).message);
    }
  };
  return (
    <div className="revision-note carried-words" role="status">
      <Sparkles size={16} aria-hidden="true" />
      <div className="grow">
        <p>You said: “{words}”</p>
        <button className="button small" disabled={disabled || asking} onClick={() => void run()}>{asking ? 'Claude’s changing it…' : 'Have Claude change the recipe'}</button>
        {problem && <p className="error small">{problem}</p>}
      </div>
    </div>
  );
}
