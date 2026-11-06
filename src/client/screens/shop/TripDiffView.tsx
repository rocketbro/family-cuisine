// The record of a trip: what the app suggested against what happened.
import type { ReceiptView } from '../../../shared/api-types.ts';
import { lineDetail } from './receiptText.ts';

export function TripDiffView({ receipt }: { receipt: ReceiptView }) {
  const { bought, skipped, extras } = receipt.diff;
  return (
    <>
      <p className="faint small section">The whole trip: every receipt saved for it, against the list you went in with.</p>
      {!receipt.listSaved && <p className="faint small section">No list was saved for this trip, so this is only what was bought.</p>}
      {bought.length > 0 && (
        <section className="section">
          <span className="eyebrow">Bought from the list · {bought.length}</span>
          <div className="list">
            {bought.map(b => (
              <div className="list-row" key={b.line.key}><span className="grow">{b.line.name}<div className="faint small">{b.matched.map(lineDetail).join(' · ')}</div></span></div>
            ))}
          </div>
        </section>
      )}
      {skipped.length > 0 && (
        <section className="section">
          <span className="eyebrow">On the list, not bought · {skipped.length}</span>
          <div className="list">
            {skipped.map(l => <div className="list-row" key={l.key}><span className="grow">{l.name}{l.neededFor.length > 0 && <div className="faint small">for {l.neededFor.join(', ')}</div>}</span></div>)}
          </div>
        </section>
      )}
      {extras.length > 0 && (
        <section className="section">
          <span className="eyebrow">Not on the list · {extras.length}</span>
          <div className="list">
            {extras.map((l, i) => <div className="list-row" key={i}><span className="grow">{l.name}<div className="faint small">{lineDetail(l)}</div></span></div>)}
          </div>
        </section>
      )}
    </>
  );
}
