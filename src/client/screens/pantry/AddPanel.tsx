// Adding stock: bought more, or found some. The total goes up, and the panel says to what before
// anything changes. A plain item gets its first amount the same way ("Say how much").
import { useState } from 'react';
import type { ISODate } from '../../../domain/dates.ts';
import type { PantryItem } from '../../../domain/pantry.ts';
import { portionsAfterAdding } from '../../../domain/portion-add.ts';
import { totalText } from '../../../domain/portion-move.ts';
import { portionText, portionsText, STORAGES, type Storage } from '../../../domain/portions.ts';
import { parseUnit } from '../../../domain/units.ts';
import { Segmented } from '../../ui/Common.tsx';
import { STORAGE_LABEL, type SaveChange } from './item-change.ts';
import { PickSelect } from './PickField.tsx';
import { UNIT_OPTIONS, unitOptions } from './units.ts';

const STARTING_UNIT: Partial<Record<Storage, string>> = { canned: 'can', dried: 'lb' };

type Props = { item: PantryItem; today: ISODate; onChange: SaveChange; onDone: () => void };

export function AddPanel({ item, today, onChange, onDone }: Props) {
  const plain = item.portions.length === 0;
  const [storage, setStorage] = useState<Storage>(item.portions[0]?.storage ?? 'fresh');
  const [typed, setTyped] = useState('');
  const [chosenUnit, setChosenUnit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const existing = item.portions.find(p => p.storage === storage) ?? null;
  const unitName = existing ? existing.unit ?? '' : chosenUnit ?? STARTING_UNIT[storage] ?? item.portions[0]?.unit ?? '';
  const amount = Number.parseFloat(typed) > 0 ? Number.parseFloat(typed) : null;
  // More of what's already here needs a number; a new form of it can be "some".
  const ready = !existing || (amount !== null && existing.amount !== null);
  const add = { storage, amount, unit: parseUnit(unitName) };
  const after = portionsAfterAdding(item, add, today);
  const total = totalText(after);
  const adding = portionText(add);

  const confirm = async () => {
    setBusy(true);
    const saved = await onChange({ add });
    setBusy(false);
    if (saved) onDone();
  };

  return (
    <div className="item-panel">
      <p className="item-panel-title">{plain ? 'Say how much' : 'Add more'}</p>
      <Segmented label="Kept how" value={storage} onChange={setStorage} options={STORAGES.map(s => ({ value: s, label: STORAGE_LABEL[s] }))} />
      <div className="row">
        <input className="field item-amount" inputMode="decimal" placeholder="Some" aria-label={plain ? 'How much' : 'How much more'} value={typed} onChange={e => setTyped(e.target.value.replace(/[^\d.]/g, ''))} />
        <PickSelect label="Unit" value={unitName} onChange={setChosenUnit} options={existing ? unitOptions(existing.unit).filter(o => o.value === unitName) : UNIT_OPTIONS} />
      </div>
      {existing?.amount === null
        ? <p className="item-note">This is “some”, so there’s no number to add to. Type how much on its line above.</p>
        : !ready
          ? <p className="item-note">Say how much more.</p>
          : (
            <div>
              <p className="item-panel-result">{plain ? `Will read: ${portionsText(after)}` : `${portionsText(item.portions)} → ${portionsText(after)}`}</p>
              {!plain && total && <p className="item-note">Now {total} in all.</p>}
            </div>
          )}
      <div className="row">
        <button type="button" className="button" disabled={!ready || busy} onClick={() => void confirm()}>{busy ? 'Saving…' : `Add ${adding}`}</button>
        <button type="button" className="button quiet" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}
