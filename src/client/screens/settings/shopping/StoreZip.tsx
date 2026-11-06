// The ZIP code: for the sales tax estimate, and for Aldi's prices if that lookup is turned on.
import { useState } from 'react';
import { api } from '../../../api.ts';
import { announceChange } from '../../../data-events.ts';
import type { SaveState } from '../../../hooks/useSaveState.ts';
import { FormField } from '../../../ui/FormField.tsx';
import { SaveNote } from '../../../ui/SaveNote.tsx';

type Props = { current: { zip: string; place: string } | null; aldiLookup: boolean; save: SaveState; onSaved: () => Promise<void> };

export function StoreZip({ current, aldiLookup, save, onSaved }: Props) {
  const [zip, setZip] = useState(current?.zip ?? '');
  const changed = zip.trim() !== (current?.zip ?? '');

  const persist = () => save.run(async () => {
    await api.setStoreZip(zip.trim() || null);
    announceChange();
    await onSaved();
  });

  const help = !aldiLookup ? 'Optional. The list uses it to estimate sales tax.'
    : current ? `Prices from the Aldi near ${current.place}, checked weekly. Also used for sales tax.`
      : 'The list shows each item’s price at your nearest Aldi, and estimates sales tax.';

  return (
    <FormField label={aldiLookup ? 'Aldi prices near' : 'Your ZIP code'} htmlFor="store-zip" help={help}>
      <form className="form-with-button" onSubmit={e => { e.preventDefault(); void persist(); }}>
        <input id="store-zip" className="field" inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="ZIP code"
          value={zip} onChange={e => setZip(e.target.value.replace(/\D/g, ''))} />
        {changed && <button className="button" disabled={save.phase === 'saving'}>Save</button>}
      </form>
      <SaveNote save={save} saving="Finding it…" />
    </FormField>
  );
}
