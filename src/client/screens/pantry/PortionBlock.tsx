// One way an item is kept: how much, its date, and moving it to the other form when that makes sense.
import type { ISODate } from '../../../domain/dates.ts';
import { moveTarget } from '../../../domain/portion-move.ts';
import type { Portion } from '../../../domain/portions.ts';
import { parseUnit } from '../../../domain/units.ts';
import { MOVE_LABEL, STORAGE_LABEL } from './item-change.ts';
import { PickSelect } from './PickField.tsx';
import { SaveMark } from './SaveMark.tsx';
import { unitOptions } from './units.ts';
import { UseByLine } from './UseByLine.tsx';
import { useSavedField } from './useSavedField.ts';

type Props = {
  name: string;
  portion: Portion;
  today: ISODate;
  onSave: (change: Partial<Portion>) => Promise<boolean>;
  onMove: () => void;
};

export function PortionBlock({ name, portion, today, onSave, onMove }: Props) {
  const label = STORAGE_LABEL[portion.storage];
  const target = moveTarget(portion.storage);
  const amount = useSavedField(portion.amount === null ? '' : String(portion.amount), {
    accept: text => text.replace(/[^\d.]/g, ''),
    tidy: text => { const parsed = Number.parseFloat(text); return Number.isNaN(parsed) ? '' : String(parsed); },
    // Blank is "some"; 0 means none left, and the portion goes.
    save: text => onSave({ amount: text === '' ? null : Number.parseFloat(text) }),
  });

  return (
    <div className="portion-block">
      <div className="item-line">
        <span className="item-label">{label}</span>
        <input className="field item-amount" inputMode="decimal" placeholder="Some" aria-label={`How much ${portion.storage} ${name}`} {...amount.input} />
        <PickSelect label={`${label} unit`} value={portion.unit ?? ''} onChange={u => void onSave({ unit: parseUnit(u) })} options={unitOptions(portion.unit)} />
        <span className="item-line-end"><SaveMark field={amount} /></span>
      </div>
      <UseByLine name={`${portion.storage} ${name}`} useBy={portion.useBy} estimated={portion.useByEstimated} today={today} onChange={useBy => void onSave({ useBy })} />
      <div className="item-line">
        <span className="item-label" />
        <span className="row item-actions">
          {target && <button type="button" className="chip" onClick={onMove}>{MOVE_LABEL[target]}</button>}
          <button type="button" className="chip" aria-label={`None left of the ${portion.storage} ${name}`} onClick={() => void onSave({ amount: 0 })}>None left</button>
        </span>
      </div>
    </div>
  );
}
