// Other names a recipe might use for this, so "jam" finds the raspberry preserves.
import type { PantryItem } from '../../../domain/pantry.ts';
import type { SaveChange } from './item-change.ts';
import { SaveMark } from './SaveMark.tsx';
import { useSavedField } from './useSavedField.ts';

const namesIn = (text: string) => [...new Set(text.split(',').map(name => name.trim().toLowerCase()).filter(Boolean))];

export function AlsoCalledField({ item, onChange }: { item: PantryItem; onChange: SaveChange }) {
  const field = useSavedField(item.alsoCalled.join(', '), {
    tidy: text => namesIn(text).join(', '),
    save: text => onChange({ alsoCalled: namesIn(text) }),
  });
  return (
    <div className="stack details-group">
      <div className="spread"><label className="eyebrow" htmlFor="also-called">Other names</label><SaveMark field={field} /></div>
      <input id="also-called" className="field" placeholder="None yet" {...field.input} />
      <p className="item-note">When a recipe asks for one of these, it means this item. Comma between names.</p>
    </div>
  );
}
