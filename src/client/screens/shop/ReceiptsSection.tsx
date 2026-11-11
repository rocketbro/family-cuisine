// The bottom of the list: add a receipt, see past trips, and what they suggest changing.
import { Receipt as ReceiptIcon } from 'lucide-react';
import { shortDate } from '../../../domain/dates.ts';
import type { ReceiptSummary } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { TabLink } from '../../navigation/TabLink.tsx';
import { dollars, STORE_NAME } from './receiptText.ts';
import { useReceiptUpload } from './useReceiptUpload.ts';

const STATE: Partial<Record<ReceiptSummary['status'], string>> = { reading: 'Reading…', failed: 'Couldn’t read it', ready: 'Ready to check' };

export function ReceiptsSection() {
  const { data, reload } = useLoad('trips', () => api.trips());
  const { busy, error, setError, upload } = useReceiptUpload();
  const decide = async (key: string, change: (() => Promise<unknown>) | null) => {
    setError(null);
    try {
      await (change ? change() : api.dismissSuggestion(key));
      announceChange();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section className="section">
      <span className="eyebrow">Receipts</span>
      <label className="button quiet wide" style={{ cursor: 'pointer', marginTop: 10 }}>
        <ReceiptIcon size={18} /> {busy ? 'Sending it…' : 'Add a receipt'}
        <input type="file" accept="image/*,application/pdf" multiple hidden disabled={busy} onChange={e => void upload(Array.from(e.target.files ?? []))} />
      </label>
      <p className="faint small" style={{ marginTop: 6 }}>A photo, a screenshot or a PDF. Add several for a long one.</p>
      {error && <p className="error">{error}</p>}

      {data?.suggestions.map(s => (
        <div key={s.key} className="notice" style={{ marginTop: 10 }}>
          <p style={{ margin: 0 }}>
            {s.kind === 'keep-stocked'
              ? <>You bought <strong>{s.name}</strong> off-list on {s.trips} trips. Keep it stocked?</>
              : <>You skipped <strong>{s.name}</strong> on {s.trips} trips. Stop keeping it stocked?</>}
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="chip" onClick={() => decide(s.key, () => api.updatePantryItem(s.pantryItemId, { occasional: s.kind === 'as-needed' }))}>Yes</button>
            <button className="chip" onClick={() => decide(s.key, null)}>No</button>
          </div>
        </div>
      ))}

      {!!data?.receipts.length && (
        <div className="list" style={{ marginTop: 10 }}>
          {data.receipts.map(r => (
            <TabLink key={r.id} to={`/shop/receipts/${r.id}`} className="list-row plain-button" style={{ textDecoration: 'none' }}>
              <span className="grow">
                {STORE_NAME[r.store]}, {shortDate(r.shopDate)}
                <div className="faint small">{STATE[r.status] ?? `${r.itemCount} item${r.itemCount === 1 ? '' : 's'}${r.totalCents !== null ? ` · ${dollars(r.totalCents)}` : ''}`}</div>
              </span>
            </TabLink>
          ))}
        </div>
      )}
    </section>
  );
}
