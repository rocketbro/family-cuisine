// How many are left. The number can be typed as well as stepped, for going from 18 eggs to 6.
import { COUNT_LOW_AT, listEffect, type PantryItem } from '../../../domain/pantry.ts';
import type { SaveChange } from './item-change.ts';
import { SaveMark } from './SaveMark.tsx';
import { useSavedField } from './useSavedField.ts';

export function CountField({ item, onChange }: { item: PantryItem; onChange: SaveChange }) {
  const count = item.count ?? 0;
  const field = useSavedField(String(count), {
    accept: text => text.replace(/\D/g, ''),
    // Left blank, it goes back to the number it was. Saying 0 is how to say there are none.
    tidy: text => (text === '' ? String(count) : String(Number.parseInt(text, 10))),
    save: text => onChange({ count: Number.parseInt(text, 10) }),
  });

  return (
    <>
      <div className="item-line">
        <span className="item-label">How many</span>
        <span className="stepper item-stepper">
          <button type="button" aria-label={`One fewer ${item.name}`} disabled={count <= 0} onClick={() => void onChange({ count: count - 1 })}>−</button>
          <input aria-label={`How many ${item.name}`} inputMode="numeric" {...field.input} />
          <button type="button" aria-label={`One more ${item.name}`} onClick={() => void onChange({ count: count + 1 })}>+</button>
        </span>
        <SaveMark field={field} />
      </div>
      <p className="item-note">{listEffect(item) ?? `Reads as low at ${COUNT_LOW_AT} or fewer.`}</p>
    </>
  );
}
