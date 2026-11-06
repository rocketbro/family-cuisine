// One receipt: reading it, looking it over, then the record of the trip it belongs to.
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { shortDate } from '../../domain/dates.ts';
import { api } from '../api.ts';
import { announceChange } from '../data-events.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { useWrite } from '../hooks/useWrite.ts';
import { useBack } from '../navigation/useTabNav.ts';
import { Loading, Problem } from '../ui/Common.tsx';
import { ReceiptReview } from './shop/ReceiptReview.tsx';
import { dollars, STORE_NAME } from './shop/receiptText.ts';
import { TripDiffView } from './shop/TripDiffView.tsx';

const POLL_MS = 3000;

export function ReceiptScreen() {
  const id = Number(useParams().id);
  const { data: receipt, error, reload } = useLoad(`receipt-${id}`, () => api.receipt(id));
  const back = useBack();
  const write = useWrite();
  const reading = receipt?.status === 'reading';

  // It's read on the server, so leaving and coming back is fine.
  useEffect(() => {
    if (!reading) return;
    const timer = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [reading, reload]);

  if (!receipt) return <div className="page">{error ? <Problem message={error} onRetry={reload} /> : <Loading />}</div>;

  const discard = () => write.run(async () => {
    await api.removeReceipt(id);
    announceChange();
    back();
  });
  const retry = () => write.run(async () => { await api.retryReceipt(id); await reload(); });

  return (
    <div className="page">
      <h1>{STORE_NAME[receipt.store]}</h1>
      <p className="muted italic">
        {shortDate(receipt.purchasedOn ?? receipt.shopDate)}{receipt.totalCents !== null ? ` · ${dollars(receipt.totalCents)}` : ''}
      </p>

      {reading && <p className="section muted italic">Reading the receipt against your list. You can leave this screen; it’ll keep going.</p>}
      {receipt.status === 'failed' && (
        <section className="section">
          <p className="error">{receipt.error}</p>
          <button className="button wide" onClick={retry}>Try again</button>
        </section>
      )}
      {receipt.status === 'ready' && <ReceiptReview receipt={receipt} onSaved={() => void reload()} onPricesSaved={back} />}
      {receipt.status === 'applied' && <TripDiffView receipt={receipt} />}

      <section className="section row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {receipt.files.map((file, i) => <a
          key={file.url}
          className="chip"
          href={file.url}
          target="_blank"
          rel="noreferrer"
        >
          See the receipt{receipt.files.length > 1 ? ` ${i + 1}` : ''}
        </a>)}
        {receipt.status !== 'applied' && <button className="chip" onClick={discard}>Discard</button>}
      </section>
      {write.problem && <p className="error">{write.problem}</p>}
    </div>
  );
}
