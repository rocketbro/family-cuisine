// "Grab candles": one typed line, for this trip only.
import { useState, type FormEvent } from 'react';
import type { Store } from '../../../domain/pantry.ts';
import { api } from '../../api.ts';
import { useWrite } from '../../hooks/useWrite.ts';
import { Problem } from '../../ui/Common.tsx';
import { Sheet } from '../../ui/Sheet.tsx';

type Props = { store: Store; reload: () => Promise<void>; onClose: () => void };

export function AddLineSheet({ store, reload, onClose }: Props) {
  const [name, setName] = useState('');
  const [already, setAlready] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const write = useWrite();

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const typed = name.trim();
    if (!typed || saving) return;
    setSaving(true);
    await write.run(async () => {
      const { already: onList } = await api.addOneOff(typed);
      await reload();
      if (onList) setAlready(typed);
      else onClose();
    });
    setSaving(false);
  };

  return (
    <Sheet title="Add something" onClose={onClose}>
      <form className="stack" onSubmit={add}>
        <input className="field" autoFocus aria-label="What to get" placeholder="Candles" maxLength={80} enterKeyHint="done" value={name}
          onChange={e => { setName(e.target.value); setAlready(null); }} />
        <p className="faint small" style={{ margin: 0 }}>Just this trip, on the {store === 'aldi' ? 'Aldi' : 'Walmart'} list. Stays out of the pantry.</p>
        {already && <p className="small" style={{ margin: 0 }}>{already} is already on the list.</p>}
        <button className="button wide" disabled={!name.trim() || saving}>Add to the list</button>
      </form>
      {write.problem && <Problem message={write.problem} onRetry={write.retry} />}
    </Sheet>
  );
}
