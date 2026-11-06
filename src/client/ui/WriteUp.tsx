// A meal that's only a name ("Sausage and pepper skillet"): have Claude write the recipe for it.
import { useState } from 'react';
import type { ISODate } from '../../domain/dates.ts';
import type { PlanSlot } from '../../domain/plan-slot.ts';
import { api } from '../api.ts';
import { announceChange } from '../data-events.ts';

export function WriteUp({ date, slot, title, onDone }: { date: ISODate; slot: PlanSlot; title: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const write = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.writeUpNote(date, slot);
      announceChange();
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <button className="button quiet wide" disabled={busy} onClick={write}>{busy ? 'Writing the recipe…' : `Write up “${title}” as a recipe`}</button>
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
