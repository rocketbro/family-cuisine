// Ounces on each can's label, so a recipe's "15 oz can" can be compared with what's on the shelf.
import type { Portion } from '../../../domain/portions.ts';
import { SaveMark } from './SaveMark.tsx';
import { useSavedField } from './useSavedField.ts';

export function CanSizeField({ portion, onSave }: { portion: Portion; onSave: (canOz: number | null) => Promise<boolean> }) {
  const field = useSavedField(portion.canOz === null ? '' : String(portion.canOz), {
    accept: text => text.replace(/[^\d.]/g, ''),
    tidy: text => { const oz = Number.parseFloat(text); return oz > 0 ? String(oz) : ''; },
    save: text => onSave(text ? Number.parseFloat(text) : null),
  });
  return (
    <label className="spread">
      <span className="grow">Ounces per can</span>
      <SaveMark field={field} />
      <input className="field item-amount" inputMode="decimal" placeholder="–" {...field.input} />
    </label>
  );
}
