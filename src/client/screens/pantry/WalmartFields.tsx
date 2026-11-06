// Which Walmart product this is, and the fewest to put in the cart.
import { parseWalmartItemId, type PantryItem } from '../../../domain/pantry.ts';
import { walmartProductUrl } from '../../../domain/walmart.ts';
import type { SaveChange } from './item-change.ts';
import { SaveMark } from './SaveMark.tsx';
import { useSavedField } from './useSavedField.ts';

export function WalmartFields({ item, onChange }: { item: PantryItem; onChange: SaveChange }) {
  const field = useSavedField(item.walmartItemId ?? '', {
    // A pasted link reads as its item number once it's saved.
    tidy: text => parseWalmartItemId(text) ?? text.trim(),
    save: text => {
      if (text && !parseWalmartItemId(text)) return false;
      return onChange({ walmartItemId: text || null });
    },
  });

  return (
    <section className="stack details-group">
      <div className="spread"><label className="eyebrow" htmlFor="walmart-item">Walmart item</label><SaveMark field={field} /></div>
      <input id="walmart-item" className="field" placeholder="Paste the product link" {...field.input} />
      {field.state === 'failed'
        ? <p className="error" style={{ margin: 0 }}>That isn’t a Walmart link or item number.</p>
        : (
          <p className="item-note">
            {item.walmartItemId ? <>The cart gets <a href={walmartProductUrl(item.walmartItemId)} target="_blank" rel="noreferrer">item {item.walmartItemId}</a>.</> : 'None set, so the cart can’t add this by itself.'}
          </p>
        )}
      {item.walmartItemId && (
        <div className="spread">
          <span>Fewest in the cart</span>
          <span className="stepper">
            <button type="button" aria-label="One fewer in the cart" disabled={item.minPackages <= 1} onClick={() => void onChange({ minPackages: item.minPackages - 1 })}>−</button>
            <span>{item.minPackages}</span>
            <button type="button" aria-label="One more in the cart" onClick={() => void onChange({ minPackages: item.minPackages + 1 })}>+</button>
          </span>
        </div>
      )}
    </section>
  );
}
