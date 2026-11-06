// Moving stock between the fridge and the freezer, with the result said before it happens. All of
// it is the starting amount, so "I froze this" is one tap. Nothing changes until the button.
import { useState } from 'react';
import { type ISODate } from '../../../domain/dates.ts';
import type { PantryItem } from '../../../domain/pantry.ts';
import { movePreview, stockAsPortions, type MovePreview } from '../../../domain/portion-move.ts';
import type { Storage } from '../../../domain/portions.ts';
import { formatAmount } from '../../../domain/quantity.ts';
import { unitLabel } from '../../../domain/units.ts';
import { MOVE_LABEL, type SaveChange } from './item-change.ts';

type Props = { item: PantryItem; from: Storage; to: Storage; today: ISODate; onChange: SaveChange; onDone: (done: { words: string; after: string } | null) => void };

export function MovePanel({ item, from, to, today, onChange, onDone }: Props) {
  const stock = stockAsPortions(item);
  const source = stock.find(p => p.storage === from)!;
  const [typed, setTyped] = useState(source.amount === null ? '' : String(source.amount));
  const [busy, setBusy] = useState(false);
  const amount = source.amount === null ? null : Number.parseFloat(typed) || 0;
  const move = { from, to, amount };
  const preview = movePreview(stock, move, item.lastsDays, today);
  const problem = 'problem' in preview ? preview.problem : null;
  const unitFor = (n: number) => (source.unit ? ` ${unitLabel(source.unit, n)}` : '');
  const place = MOVE_LABEL[to]!.replace('Move ', '');

  const confirm = async () => {
    setBusy(true);
    const saved = await onChange({ move });
    setBusy(false);
    const done = preview as MovePreview;
    if (saved) onDone({ words: `Moved. Now ${done.after}. ${done.total}`, after: done.after });
  };

  return (
    <div className="item-panel">
      <p className="item-panel-title">{MOVE_LABEL[to]}</p>
      {source.amount !== null && (
        <label className="row">
          <span className="grow">How much</span>
          <input className="field item-amount" inputMode="decimal" aria-label="How much to move" value={typed} onChange={e => setTyped(e.target.value.replace(/[^\d.]/g, ''))} />
          <span className="item-of">of {formatAmount(source.amount)}{unitFor(source.amount)}</span>
        </label>
      )}
      {problem
        ? <p className="error" style={{ margin: 0 }}>{problem}</p>
        : <MoveResult preview={preview as MovePreview} />}
      <div className="row">
        <button type="button" className="button" disabled={!!problem || busy} onClick={() => void confirm()}>{busy ? 'Moving…' : amount === null ? `Move ${place}` : `Move ${formatAmount(amount)}${unitFor(amount)} ${place}`}</button>
        <button type="button" className="button quiet" onClick={() => onDone(null)}>Cancel</button>
      </div>
    </div>
  );
}

function MoveResult({ preview }: { preview: MovePreview }) {
  return (
    <div>
      <p className="item-panel-result">{preview.before} → {preview.after}</p>
      <p className="item-note">{preview.total}{preview.date && ` ${preview.date}`}</p>
    </div>
  );
}
