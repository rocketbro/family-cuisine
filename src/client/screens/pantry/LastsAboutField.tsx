// How long an item usually lasts, which sets its date each time it's restocked.
import type { PantryItem } from '../../../domain/pantry.ts';
import type { SaveChange } from './item-change.ts';
import { SaveMark } from './SaveMark.tsx';
import { useSavedField } from './useSavedField.ts';

const MAX_DAYS = 730;

export function LastsAboutField({ item, onChange }: { item: PantryItem; onChange: SaveChange }) {
  const field = useSavedField(item.lastsDays === null ? '' : String(item.lastsDays), {
    accept: text => text.replace(/\D/g, ''),
    tidy: text => { const days = Number.parseInt(text, 10); return days > 0 ? String(Math.min(days, MAX_DAYS)) : ''; },
    save: text => onChange({ lastsDays: text ? Number.parseInt(text, 10) : null }),
  });
  return (
    <div className="stack details-group">
      <div className="spread">
        <label className="grow" htmlFor="lasts-about">Lasts about</label>
        <SaveMark field={field} />
        <input id="lasts-about" className="field item-amount" inputMode="numeric" placeholder="–" {...field.input} />
        <span>days</span>
      </div>
      <p className="item-note">
        {item.lastsDays ? `Each time it’s restocked, the date is set ${item.lastsDays} day${item.lastsDays > 1 ? 's' : ''} out.` : 'Blank: restocking sets no date. For things that go bad.'}
      </p>
    </div>
  );
}
