// A recipe Claude came up with: keep it among the family's own, or never see it again.
import { useState } from 'react';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useBack } from '../../navigation/useTabNav.ts';
import { AvoidMeal } from '../../ui/AvoidMeal.tsx';

export function PickNotice({ slug, title, onKept }: { slug: string; title: string; onKept: () => void }) {
  const back = useBack();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keep = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.keepPick(slug);
      onKept();
      announceChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="notice" style={{ marginTop: 12 }}>
      <span className="eyebrow">Claude’s pick</span>
      <p className="small" style={{ margin: '6px 0 10px' }}>Claude came up with this one. If it’s a keeper, it joins your regular recipes.</p>
      <button className="button quiet wide" disabled={busy} onClick={keep}>Add to our recipes</button>
      <AvoidMeal title={title} slug={slug} onDone={back} />
      {error && <p className="error">{error}</p>}
    </div>
  );
}
