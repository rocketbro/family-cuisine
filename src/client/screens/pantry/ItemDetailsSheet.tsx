// See all: everything about an item that isn't changed standing in the kitchen.
import type { ReactNode } from 'react';
import { CATEGORIES, type PantryItem, type StorePreference } from '../../../domain/pantry.ts';
import { Segmented } from '../../ui/Common.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { AlsoCalledField } from './AlsoCalledField.tsx';
import { CanSizeField } from './CanSizeField.tsx';
import { CountField } from './CountField.tsx';
import { portionsWith, type SaveChange } from './item-change.ts';
import { LastsAboutField } from './LastsAboutField.tsx';
import { PickSelect } from './PickField.tsx';
import { RemoveItem } from './RemoveItem.tsx';
import { WalmartFields } from './WalmartFields.tsx';

const STORE_WORDS: Record<StorePreference, string> = {
  any: 'Goes on the list for whichever store you’re shopping that week.',
  aldi: 'Always on the Aldi list, whichever store you’re shopping that week.',
  walmart: 'Always on the Walmart list, whichever store you’re shopping that week.',
};

type Props = { item: PantryItem; onClose: () => void; onChange: SaveChange; onRemove: () => void; problem: ReactNode };

export function ItemDetailsSheet({ item, onClose, onChange, onRemove, problem }: Props) {
  const cans = item.portions.filter(p => p.unit === 'can' && p.amount !== 0);

  return (
    <Sheet title={item.name} onClose={onClose}>
      <div className="details">
        <section className="stack details-group">
          <span className="eyebrow">Going on the list</span>
          <Toggle
            label="Keep stocked" on={!item.occasional} disabled={item.staple} onToggle={() => void onChange({ occasional: !item.occasional })}
            says="When it’s low or out, it goes on the list by itself."
          />
          <Toggle
            label="Always on hand" on={item.staple} onToggle={() => void onChange({ staple: !item.staple })}
            says="Like salt: never asked about, never on the list."
          />
        </section>

        <section className="stack details-group">
          <span className="eyebrow">Where to buy it</span>
          <Segmented label="Where to buy it" value={item.store} onChange={store => void onChange({ store })}
            options={[{ value: 'any', label: 'Either store' }, { value: 'aldi', label: 'Aldi only' }, { value: 'walmart', label: 'Walmart only' }]} />
          <p className="item-note">{STORE_WORDS[item.store]}</p>
        </section>

        {item.portions.length === 0 && (
          <section className="stack details-group">
            <span className="eyebrow">How it’s kept track of</span>
            <Segmented label="How it's kept track of" value={item.count !== null ? 'count' : 'status'}
              onChange={v => void onChange({ count: v === 'count' ? (item.status === 'out' ? 0 : 6) : null })}
              options={[{ value: 'status', label: 'Have / low / out' }, { value: 'count', label: 'Count them' }]} />
            {item.count !== null && <CountField item={item} onChange={onChange} />}
          </section>
        )}

        <section className="stack details-group">
          <span className="eyebrow">How long it keeps</span>
          <LastsAboutField item={item} onChange={onChange} />
          {cans.map(p => <CanSizeField key={p.storage} portion={p} onSave={canOz => onChange({ portions: portionsWith(item.portions, p.storage, { canOz }) })} />)}
        </section>

        <AlsoCalledField item={item} onChange={onChange} />
        <WalmartFields item={item} onChange={onChange} />

        <section className="stack details-group">
          <span className="eyebrow">Listed under</span>
          <PickSelect label="Listed under" value={item.category} onChange={category => void onChange({ category })}
            options={[...new Set([...CATEGORIES, item.category])].map(c => ({ value: c, label: c }))} />
        </section>

        {problem}
        <RemoveItem item={item} onRemove={onRemove} />
      </div>
    </Sheet>
  );
}

function Toggle({ label, says, on, disabled, onToggle }: { label: string; says: string; on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <label className="details-toggle">
      <input type="checkbox" checked={on} disabled={disabled} onChange={onToggle} />
      <span className="grow">{label}<span className="item-note">{says}</span></span>
    </label>
  );
}
