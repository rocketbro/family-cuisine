// Have, low or out, and what that does to the list. Out on an item with amounts wipes them,
// so it says which before it does.
import { useState } from 'react';
import { listEffect, type PantryItem, type StockStatus } from '../../../domain/pantry.ts';
import { portionsText } from '../../../domain/portions.ts';
import { Segmented } from '../../ui/Common.tsx';
import type { SaveChange } from './item-change.ts';

const OPTIONS: { value: StockStatus; label: string }[] = [{ value: 'have', label: 'Have' }, { value: 'low', label: 'Low' }, { value: 'out', label: 'Out' }];

export function StockState({ item, onChange }: { item: PantryItem; onChange: SaveChange }) {
  const [confirming, setConfirming] = useState(false);
  const effect = listEffect(item);

  const pick = (status: StockStatus) => {
    if (status === 'out' && item.portions.length) { setConfirming(true); return; }
    setConfirming(false);
    if (status !== item.status) void onChange({ status });
  };

  return (
    <>
      <Segmented label={`How much ${item.name} is left`} value={confirming ? 'out' : item.status} onChange={pick} options={OPTIONS} />
      {effect && !confirming && <p className="item-note">{effect}</p>}
      {confirming && (
        <div className="item-panel">
          <p className="item-panel-result">Out clears {portionsText(item.portions)}.</p>
          <div className="row">
            <button type="button" className="button" onClick={() => { setConfirming(false); void onChange({ status: 'out' }); }}>Yes, we’re out</button>
            <button type="button" className="button quiet" onClick={() => setConfirming(false)}>Keep it</button>
          </div>
        </div>
      )}
    </>
  );
}
