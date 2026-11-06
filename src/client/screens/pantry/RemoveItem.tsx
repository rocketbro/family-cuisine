// Taking an item out of the pantry altogether. It can't be brought back, so it asks once.
import { useState } from 'react';
import type { PantryItem } from '../../../domain/pantry.ts';

export function RemoveItem({ item, onRemove }: { item: PantryItem; onRemove: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" className="link-button remove-item" onClick={() => setAsking(true)}>Remove from pantry</button>;
  return (
    <div className="item-panel">
      <p className="item-panel-result">Remove {item.name}?</p>
      <p className="item-note">Its amounts, dates and settings go with it. Recipes that use it will show it as missing.</p>
      <div className="row">
        <button type="button" className="button remove-item-yes" onClick={onRemove}>Remove</button>
        <button type="button" className="button quiet" onClick={() => setAsking(false)}>Keep it</button>
      </div>
    </div>
  );
}
