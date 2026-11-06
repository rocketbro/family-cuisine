// Takes a recipe out of the book, after asking once.
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api.ts';
import { useBack } from '../../navigation/useTabNav.ts';

export function DeleteRecipe({ slug, title }: { slug: string; title: string }) {
  const back = useBack();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteRecipe(slug);
      back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!asking) return <button className="button quiet" style={{ marginTop: 12 }} onClick={() => setAsking(true)}><Trash2 size={16} /> Delete this recipe</button>;
  return (
    <div className="notice" style={{ marginTop: 12 }}>
      <p style={{ marginTop: 0 }}>Delete {title}? It comes off the plan too, and this can’t be undone.</p>
      <div className="row">
        <button className="button quiet grow" disabled={busy} onClick={() => setAsking(false)}>Keep it</button>
        <button className="button grow" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete'}</button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
