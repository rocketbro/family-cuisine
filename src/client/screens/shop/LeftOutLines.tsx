// Lines left off because the family never adds them: one quiet line, and a way to bring one back
// for this receipt. Taking a product off the never-add list for good is in Settings → Shopping.
import { useState } from 'react';
import type { ReceiptRow } from '../../../domain/receipt-review.ts';

export function LeftOutLines({ rows, onBringBack }: { rows: ReceiptRow[]; onBringBack: (index: number) => void }) {
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  return (
    <section className="section left-out">
      <p className="faint small">
        {rows.length} left out: you don’t track {rows.length === 1 ? 'it' : 'them'}.{' '}
        <button className="subs-link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'}</button>
      </p>
      {open && (
        <div className="list">
          {rows.map(row => (
            <div className="list-row" key={row.index}>
              <span className="grow muted">{row.name}</span>
              <button className="button small quiet" onClick={() => onBringBack(row.index)}>Add it this time</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
