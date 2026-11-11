// List lines this receipt doesn't have. Each one opens a sheet to say what was bought instead, if
// anything; one that's been given a substitute says so.
import { useState } from 'react';
import type { ReceiptRow } from '../../../domain/receipt-review.ts';
import type { TripLine } from '../../../domain/receipts.ts';
import { SubstituteSheet } from './SubstituteSheet.tsx';

type Props = {
  missing: TripLine[];
  rows: ReceiptRow[];
  /** Lines that could have been bought instead, by index. */
  candidates: ReceiptRow[];
  /** Prices only leaves the pantry alone, so there's nothing to stand in. */
  canSubstitute: boolean;
  onChoose: (listKey: string, choice: { index: number; always: boolean } | null) => void;
};

export function NotOnReceipt({ missing, rows, candidates, canSubstitute, onChoose }: Props) {
  const [open, setOpen] = useState<TripLine | null>(null);
  if (!missing.length) return null;
  const standIn = (key: string) => rows.find(r => r.insteadOf === key) ?? null;

  return (
    <section className="section">
      <span className="eyebrow">On the list, not on this receipt</span>
      {canSubstitute ? (
        <>
          <div className="not-on-receipt">
            {missing.map(line => {
              const got = standIn(line.key);
              return (
                <button key={line.key} className={`chip ${got ? 'chosen' : ''}`} onClick={() => setOpen(line)}>
                  {got ? `${line.name} → ${got.name}` : line.name}
                </button>
              );
            })}
          </div>
          <p className="faint small">Got something else instead? Tap it. The rest stay as they are.</p>
        </>
      ) : (
        <>
          <p className="muted">{missing.map(l => l.name).join(', ')}</p>
          <p className="faint small">Their records stay as they are.</p>
        </>
      )}
      {open && (
        <SubstituteSheet
          line={open}
          current={standIn(open.key)}
          candidates={candidates}
          onChoose={choice => { onChoose(open.key, choice); setOpen(null); }}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
