// "Don't suggest this again", with room to say why so Claude can steer clear of similar things.
import { useState } from 'react';
import { api } from '../api.ts';
import { announceChange } from '../data-events.ts';

type Props = {
  title: string;
  /** Set when it's a saved pick, which comes out of the book too. */
  slug: string | null;
  onDone: () => void;
};

export function AvoidMeal({ title, slug, onDone }: Props) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.avoidMeal(title, reason, slug);
      onDone();
      announceChange();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!asking) return <button className="link-button small" style={{ marginTop: 10 }} onClick={() => setAsking(true)}>Don’t suggest this again</button>;
  return (
    <div className="stack" style={{ marginTop: 10 }}>
      <input className="field" placeholder="Why not? (optional)" value={reason} onChange={e => setReason(e.target.value)} />
      <div className="row">
        <button className="button quiet grow" disabled={busy} onClick={() => setAsking(false)}>Never mind</button>
        <button className="button grow" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Don’t suggest it'}</button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
