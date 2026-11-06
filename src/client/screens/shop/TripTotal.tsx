// The bottom of the list: what the trip should come to, the budget, and where any room goes.
import { useState } from 'react';
import { formatDollars, isEstimate, parseDollars } from '../../../domain/prices.ts';
import type { ShoppingWeek } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useWrite } from '../../hooks/useWrite.ts';
import { TabLink } from '../../navigation/TabLink.tsx';

type Props = { week: ShoppingWeek; lookupError: string | null };

export function TripTotal({ week, lookupError }: Props) {
  const { total, tax, budgetCents: budget, leewayCents: leeway, stockTotalCents: stock, store, aldiLookup: lookup } = week;
  const write = useWrite();
  const editBudget = () => {
    const text = window.prompt('What can we spend on food this trip?', budget === null ? '' : (budget / 100).toFixed(0));
    if (text === null) return;
    void write.run(async () => {
      await api.setBudget(parseDollars(text));
      announceChange();
    });
  };
  const withTax = total.cents + (tax?.cents ?? 0);
  const estimated = week.lines.some(l => l.price && isEstimate(l));
  const over = budget !== null && withTax > budget ? withTax - budget : 0;

  return (
    <div className="total-card">
      {tax && (
        <>
          <div className="spread small muted"><span>Subtotal</span><span>{formatDollars(total.cents)}</span></div>
          <div className="spread small muted"><span>Estimated sales tax ({+(tax.rate * 100).toFixed(2)}%)</span><span>{formatDollars(tax.cents)}</span></div>
        </>
      )}
      <div className="spread">
        <span>{total.unpriced ? 'So far' : 'Total'}</span>
        <strong className="total-amount">{estimated ? '≈' : ''}{formatDollars(withTax)}</strong>
      </div>
      <p className="faint small" style={{ margin: '4px 0 0' }}>
        {lookup === 'running' ? 'Checking Aldi prices…'
          : lookup === 'off' && store === 'aldi' ? <>Add your ZIP code in <TabLink to="/settings/shopping">Settings</TabLink> to see Aldi’s prices.</>
          : total.unpriced ? `${total.unpriced} without a price. Add a receipt, or tap “Add price” to type one in.`
          : store === 'walmart' ? 'Walmart prices are what you paid last time.'
          : lookup === 'disabled' ? 'Prices you typed in or saved from a receipt.' : 'Prices from your Aldi, checked weekly.'}
      </p>
      {estimated && <p className="faint small" style={{ margin: '4px 0 0' }}>≈ means sold by weight or size unknown, so the real price can differ a little.</p>}
      {lookupError && <p className="error small" style={{ margin: '4px 0 0' }}>Couldn’t check Aldi just now ({lookupError}). Type prices in, or try later.</p>}
      <div className="total-budget stack" style={{ gap: 10 }}>
        <div className="spread">
          <button className="link-button" onClick={editBudget}>{budget === null ? 'Set a budget' : `Budget ${formatDollars(budget)}`}</button>
          {over > 0 && <span className="error">{formatDollars(over)} over</span>}
          {!over && leeway !== null && <span className="muted">{formatDollars(leeway)} of room</span>}
        </div>
        {write.problem && <p className="error small" style={{ margin: 0 }}>{write.problem}</p>}
        {budget !== null && leeway === null && <p className="faint small" style={{ margin: 0 }}>Too many prices are missing to tell how much room there is.</p>}
        {store === 'aldi' && leeway !== null && leeway > 0 && <FindsSlider key={leeway} saved={Math.min(week.findsCents, leeway)} most={leeway} />}
        {leeway !== null && stock > 0 && <div className="spread small muted"><span>Stocking up</span><span>{formatDollars(stock)}</span></div>}
      </div>
    </div>
  );
}

/** How much of the room is set aside for whatever turns up in the middle aisle at Aldi. */
function FindsSlider({ saved, most }: { saved: number; most: number }) {
  const [cents, setCents] = useState(saved);
  const write = useWrite();
  const commit = async () => {
    if (cents === saved) return;
    const stored = await write.run(async () => {
      await api.setFinds(cents);
      announceChange();
    });
    if (!stored) setCents(saved);
  };
  return (
    <label className="stack" style={{ gap: 4 }}>
      <span className="spread small"><span>Aldi finds</span><strong>{formatDollars(cents)}</strong></span>
      <input type="range" className="finds-slider" min={0} max={most} step={100} value={cents}
        onChange={e => setCents(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} onTouchEnd={commit} />
      {write.problem && <span className="error small">{write.problem}</span>}
    </label>
  );
}
