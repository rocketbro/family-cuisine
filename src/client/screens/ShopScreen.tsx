// The grocery list for the coming trip: pick the store, check things off as you go. Aldi
// shows prices and a total against the week's budget; Walmart fills the cart in one tap.
import { Plus, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { shortDate, weekdayName } from '../../domain/dates.ts';
import type { Store } from '../../domain/pantry.ts';
import { alreadySent } from '../../domain/walmart.ts';
import { api } from '../api.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { useWrite } from '../hooks/useWrite.ts';
import { usePreferences } from '../preferences.ts';
import { Loading, Problem, Segmented } from '../ui/Common.tsx';
import { AddLineSheet } from './shop/AddLineSheet.tsx';
import { LineSheet } from './shop/LineSheet.tsx';
import { copyList } from './shop/lineText.ts';
import { loadShoppingList } from './shop/load-list.ts';
import { whenLookupFinishes } from './shop/lookup-poll.ts';
import { newPutAwayToken } from './shop/putAwayToken.ts';
import { ListViewSheet } from './shop/ListViewSheet.tsx';
import { ReceiptsSection } from './shop/ReceiptsSection.tsx';
import { ShopLines } from './shop/ShopLines.tsx';
import { SkippedLines } from './shop/SkippedLines.tsx';
import { StockUpSection } from './shop/StockUpSection.tsx';
import { TicksNote } from './shop/TicksNote.tsx';
import { TrimSheet } from './shop/TrimSheet.tsx';
import { TripTotal } from './shop/TripTotal.tsx';
import { useLineActions } from './shop/useLineActions.ts';
import { useListRefresh } from './shop/useListRefresh.ts';
import { useTicks } from './shop/useTicks.ts';
import { WalmartCartButton } from './shop/WalmartCartButton.tsx';

export function ShopScreen() {
  const { data: week, error, reload, refresh } = useLoad('shopping', loadShoppingList);
  const ticks = useTicks(week?.shopDate ?? null, week?.ticks ?? null);
  const actions = useLineActions(reload, ticks.forget);
  const [copied, setCopied] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [prefs, updatePrefs] = usePreferences();
  const [viewing, setViewing] = useState(false);
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [trimming, setTrimming] = useState(false);
  // One per put-away, kept until it succeeds: trying again after a lost answer is the same put-away.
  const putAwayToken = useRef('');
  const putting = useWrite();
  const choosing = useWrite();
  const copying = useWrite();
  const lookup = week?.aldiLookup;
  useListRefresh(refresh);

  // With the lookup on, opening the list checks Aldi for anything unpriced or a week old (a few seconds per item).
  useEffect(() => {
    if (lookup !== 'due') return;
    let live = true;
    api.refreshPrices().then(() => { if (live) { setLookupError(null); void reload(); } })
      .catch(e => { if (live) setLookupError((e as Error).message); });
    return () => { live = false; };
  }, [lookup, reload]);

  useEffect(() => {
    if (lookup !== 'running') return;
    return whenLookupFinishes(api.shopping, () => void reload());
  }, [lookup, reload]);

  if (!week) return <div className="page">{error ? <Problem message={error} onRetry={reload} /> : <Loading />}</div>;

  const byStore = (store: Store) => week.lines.filter(l => l.store === store);
  const aldi = byStore('aldi');
  const walmart = byStore('walmart');
  // A tick on a line that's since left the list (it recalculates) isn't anything to put away.
  const tickedLines = week.lines.filter(l => ticks.checked.has(l.key));
  const tickedStock = week.stockUp.filter(l => ticks.checked.has(l.key));
  const tickedCount = tickedLines.length + tickedStock.length;
  const open = week.lines.find(l => l.key === openLine);

  // The boxes stay ticked if it fails, so nothing has to be ticked again.
  const putAway = () => putting.run(async () => {
    putAwayToken.current ||= newPutAwayToken();
    await api.markBought(tickedLines, tickedStock, putAwayToken.current);
    putAwayToken.current = '';
    ticks.forget([...tickedLines, ...tickedStock].map(l => l.key));
    await reload();
  });
  const chooseStore = (store: Store) => choosing.run(async () => { await api.chooseStore(store); await reload(); });
  const copyAldi = () => copying.run(async () => {
    await navigator.clipboard.writeText(copyList(aldi)).catch(() => { throw new Error('Couldn’t copy the list.'); });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });

  return (
    <div className="page">
      <div className="spread">
        <h1>Grocery list</h1>
        <button className="icon-button" aria-label="What the list shows" onClick={() => setViewing(true)}><SlidersHorizontal size={20} /></button>
      </div>
      <p className="muted italic">
        {weekdayName(week.shopDate)}’s trip · for meals {shortDate(week.shopDate)} – {shortDate(week.through)}
      </p>

      <section className="section">
        {!week.storeChosen && <span className="eyebrow">Where are we shopping this week?</span>}
        <Segmented label="Store" value={week.store} onChange={chooseStore}
          options={[{ value: 'aldi', label: 'Aldi run' }, { value: 'walmart', label: 'Walmart order' }]} />
        {choosing.problem && <Problem message={choosing.problem} onRetry={choosing.retry} />}
      </section>

      <TicksNote unsaved={ticks.unsaved} stuck={ticks.stuck} onRetry={ticks.retry} />

      {!week.lines.length && <p className="section muted italic">{week.skipped.length ? 'Nothing left to buy.' : 'Nothing to buy. The pantry covers the plan.'}</p>}
      {week.lines.length > 0 && <p className="faint small" style={{ margin: '10px 0 0' }}>Tap a name for Have it or Not this trip.</p>}

      {aldi.length > 0 && (
        <section className="section">
          <div className="spread"><span className="eyebrow">Aldi</span><button className="link-button" onClick={copyAldi}>{copied ? 'Copied' : 'Copy list'}</button></div>
          {copying.problem && <p className="error">{copying.problem}</p>}
          <ShopLines lines={aldi} store="aldi" checked={ticks.checked} onToggle={ticks.toggle} onOpen={setOpenLine} view={prefs.listView} />
          {aldi.some(l => l.sizeUnknown) && (
            <p className="faint small" style={{ marginTop: 10 }}>
              Don’t know the package size for {aldi.filter(l => l.sizeUnknown).map(l => l.name).join(', ')}, so the total counts one of each and may run low.
            </p>
          )}
        </section>
      )}

      {walmart.length > 0 && (
        <section className="section">
          <span className="eyebrow">Walmart{week.store === 'aldi' ? ' · things Aldi doesn’t carry' : ''}</span>
          <ShopLines lines={walmart} store="walmart" checked={ticks.checked} onToggle={ticks.toggle} onOpen={setOpenLine} view={prefs.listView} />
          {week.walmartUnmatched.length > 0 && (
            <p className="faint small" style={{ marginTop: 10 }}>
              {week.walmartUnmatched.length} still need{week.walmartUnmatched.length === 1 ? 's' : ''} a product: tap Find, open the one you buy, copy its link, then Paste link. It’s remembered after that.
            </p>
          )}
          {walmart.some(l => l.sizeUnknown) && (
            <p className="faint small" style={{ marginTop: 10 }}>
              Don’t know the package size for {walmart.filter(l => l.sizeUnknown).map(l => l.name).join(', ')}, so check there’s enough in the cart.
            </p>
          )}
        </section>
      )}

      <button className="button quiet wide section" onClick={() => setAdding(true)}><Plus size={18} /> Add something</button>
      <SkippedLines lines={week.skipped} actions={actions} />

      {week.stockUp.length > 0 && <StockUpSection lines={week.stockUp} spendCents={week.stockTotalCents} checked={ticks.checked} onToggle={key => ticks.toggle(key, !ticks.checked.has(key))} />}

      {week.lines.length > 0 && <TripTotal week={{ ...week, aldiLookup: lookupError ? 'done' : week.aldiLookup === 'due' ? 'running' : week.aldiLookup }} lookupError={lookupError} onTrim={() => setTrimming(true)} />}

      {(walmart.length > 0 || week.walmartCartUrl) && <WalmartCartButton key={week.shopDate} week={week} onChange={reload} />}

      {tickedCount > 0 && <button className="button wide section" onClick={putAway}>Put away {tickedCount} item{tickedCount > 1 ? 's' : ''}</button>}
      {putting.problem && <Problem message={putting.problem} onRetry={putting.retry} />}

      <ReceiptsSection />
      {viewing && <ListViewSheet view={prefs.listView} onChange={listView => updatePrefs({ listView })} onClose={() => setViewing(false)} />}
      {open && <LineSheet line={open} inCart={open.store === 'walmart' && alreadySent(open, week.walmartToSend)} actions={actions} onClose={() => setOpenLine(null)} />}
      {adding && <AddLineSheet store={week.store} reload={reload} onClose={() => setAdding(false)} />}
      {trimming && <TrimSheet week={week} ticked={ticks.checked} actions={actions} onClose={() => setTrimming(false)} />}
    </div>
  );
}
