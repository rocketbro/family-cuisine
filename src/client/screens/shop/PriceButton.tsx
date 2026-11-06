// A line's Aldi price: looked up by ZIP, or tap to type it. A typed price wins; clearing it
// hands the line back to the lookup.
import { useState } from 'react';
import { formatDollars, parseDollars, soldByWeight, type Price } from '../../../domain/prices.ts';

export function PriceButton({ price, onSave }: { price: Price | null; onSave: (cents: number | null) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  if (editing) {
    const save = async () => {
      setEditing(false);
      setProblem(null);
      const cents = parseDollars(text);
      if (cents !== (price?.cents ?? null) || (cents === null && price?.source === 'typed')) {
        await onSave(cents).catch((e: Error) => setProblem(e.message));
      }
    };
    return (
      <input className="field price-field" autoFocus inputMode="decimal" placeholder="$0.00" value={text}
        onChange={e => setText(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
        onClick={e => e.preventDefault()} />
    );
  }
  return (
    <span>
      <button className={`price-button ${price ? '' : 'empty'}`} title={price?.product ?? undefined}
        onClick={e => { e.preventDefault(); setText(price ? (price.cents / 100).toFixed(2) : ''); setEditing(true); }}>
        {price ? `${soldByWeight(price.product) ? '≈' : ''}${formatDollars(price.cents)}` : 'Add price'}
      </button>
      {problem && <span className="error small" style={{ display: 'block' }}>{problem}</span>}
    </span>
  );
}
