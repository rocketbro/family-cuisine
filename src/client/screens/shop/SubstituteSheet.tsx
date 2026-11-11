// One list line the receipt doesn't have: what came instead, and whether that's only this time.
// "Didn't get it" leaves the line as it is. Once a line is picked, the two ways to keep it stay in
// reach at the foot of the sheet, however long the receipt.
import { useState } from 'react';
import type { ReceiptRow } from '../../../domain/receipt-review.ts';
import type { TripLine } from '../../../domain/receipts.ts';
import { Sheet } from '../../ui/Sheet.tsx';

type Props = {
  line: TripLine;
  current: ReceiptRow | null;
  candidates: ReceiptRow[];
  onChoose: (choice: { index: number; always: boolean } | null) => void;
  onClose: () => void;
};

export function SubstituteSheet({ line, current, candidates, onChoose, onClose }: Props) {
  const [picked, setPicked] = useState<number | null>(current?.index ?? null);
  const got = candidates.find(c => c.index === picked) ?? null;

  const footer = got && (
    <div className="stack substitute-keep">
      <p className="small">{got.name} instead of {line.name}</p>
      <div className="row">
        <button className="button grow" onClick={() => onChoose({ index: got.index, always: false })}>Just this time</button>
        <button className="button quiet grow" onClick={() => onChoose({ index: got.index, always: true })}>Always fine instead</button>
      </div>
      <p className="faint small">Just this time lasts until the {got.name} runs out.</p>
    </div>
  );

  return (
    <Sheet title={line.name} onClose={onClose} footer={footer}>
      <div className="stack substitute-sheet">
        <button className="button quiet wide" onClick={() => onChoose(null)}>Didn’t get it</button>
        <span className="eyebrow">We got something else instead</span>
        <div className="list">
          {candidates.map(row => (
            <button key={row.index} className="list-row plain-button substitute-choice" aria-pressed={picked === row.index} onClick={() => setPicked(row.index)}>
              <span className="grow">{row.name}</span>
              {picked === row.index && <span className="small">Picked</span>}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
