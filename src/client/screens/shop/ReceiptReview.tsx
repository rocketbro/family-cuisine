// Looking a receipt over before anything changes: what's on the list, what's unplanned, what's
// new, and anything the model wasn't sure about. Names can be corrected right here.
import { useState } from 'react';
import type { ReceiptLine } from '../../../domain/receipts.ts';
import type { ReceiptView } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { lineDetail } from './receiptText.ts';

type Numbered = { line: ReceiptLine; index: number };

export function ReceiptReview({ receipt, onSaved, onPricesSaved }: {
  receipt: ReceiptView; onSaved: () => void; onPricesSaved: () => void;
}) {
  const { data: pantry } = useLoad('pantry', () => api.pantry());
  const [names, setNames] = useState<Map<number, string>>(new Map());
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [pricesOnly, setPricesOnly] = useState(receipt.old);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numbered: Numbered[] = receipt.lines.map((line, index) => ({ line, index }));
  const planned = new Set(receipt.diff.bought.flatMap(b => b.matched.map(m => m.printed)));
  const groups: [string, Numbered[]][] = [
    ['Check these', numbered.filter(n => n.line.unsure)],
    ['From your list', numbered.filter(n => !n.line.unsure && planned.has(n.line.printed))],
    ['Not on the list, already in the pantry', numbered.filter(n => !n.line.unsure && !planned.has(n.line.printed) && n.line.pantryItemId !== null)],
    ['New to the pantry', numbered.filter(n => !n.line.unsure && !planned.has(n.line.printed) && n.line.pantryItemId === null)],
  ];

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.applyReceipt(receipt.id, numbered.filter(n => !skipped.has(n.index)).map(n => ({ index: n.index, name: names.get(n.index) ?? n.line.name })), pricesOnly);
      announceChange();
      if (pricesOnly) onPricesSaved(); else onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const toggle = (index: number) => { const next = new Set(skipped); if (next.has(index)) next.delete(index); else next.add(index); setSkipped(next); };

  return (
    <>
      <datalist id="pantry-names">{pantry?.map(p => <option key={p.id} value={p.name} />)}</datalist>
      <label className="list-row section">
        <input type="checkbox" checked={pricesOnly} onChange={e => setPricesOnly(e.target.checked)} />
        <span className="grow">
          <span>Prices only</span>
          <span className="faint small" style={{ display: 'block' }}>
            Learn what things cost and leave the pantry and this week’s list alone. Things not in the pantry are skipped, and the receipt isn’t kept.
          </span>
        </span>
      </label>
      {groups.filter(([, lines]) => lines.length).map(([title, lines]) => (
        <section className="section" key={title}>
          <span className="eyebrow">{title}</span>
          <div className="list">
            {lines.map(({ line, index }) => (
              <div className="list-row" key={index} style={{ opacity: skipped.has(index) ? 0.45 : 1 }}>
                <input type="checkbox" aria-label={`Include ${line.name}`} checked={!skipped.has(index)} onChange={() => toggle(index)} />
                <span className="grow">
                  <input
                    className="field"
                    list="pantry-names"
                    aria-label={`What ${line.printed} is`}
                    value={names.get(index) ?? line.name}
                    onChange={e => setNames(new Map(names).set(index, e.target.value))}
                  />
                  <div className="faint small" style={{ marginTop: 4 }}>{lineDetail(line)}</div>
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
      {receipt.diff.skipped.length > 0 && (
        <section className="section">
          <span className="eyebrow">On the list, not on this receipt</span>
          <p className="muted">{receipt.diff.skipped.map(l => l.name).join(', ')}</p>
          <p className="faint small">Their records stay as they are.</p>
        </section>
      )}
      {!receipt.listSaved && <p className="faint small section">No list was saved for this trip, so there’s nothing to compare it with.</p>}
      {error && <p className="error">{error}</p>}
      <button className="button wide section" disabled={busy} onClick={save}>{busy ? 'Saving…' : pricesOnly ? 'Save prices' : 'Save to the pantry'}</button>
    </>
  );
}
