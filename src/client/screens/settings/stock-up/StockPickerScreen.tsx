// Choosing what to stock up on: only what's in the pantry, so a goal always matches what's on hand.
// Anything new goes in the Pantry first.
import { ChevronRight } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router';
import { portionsText } from '../../../../domain/portions.ts';
import { goalText } from '../../../../domain/stock-up.ts';
import type { PantryItem } from '../../../../domain/pantry.ts';
import { api } from '../../../api.ts';
import { useLoad } from '../../../hooks/useLoad.ts';
import { useOpen, useSwitchTab } from '../../../navigation/useTabNav.ts';
import { Loading, Problem } from '../../../ui/Common.tsx';
import { SettingsPage } from '../SettingsPage.tsx';
import { matchingItems } from './picker-items.ts';

function itemNote(item: PantryItem): string {
  if (item.stockUp) return `Already on your list · ${goalText(item.stockUp)} ${item.stockUp.storage}`;
  return portionsText(item.portions) || { have: 'In the house', low: 'Running low', out: 'Out' }[item.status];
}

export function StockPickerScreen() {
  const { data: pantry, error, reload } = useLoad('pantry', () => api.pantry());
  const location = useLocation();
  const open = useOpen();
  const switchTab = useSwitchTab();
  // In the address, so coming back from adding it to the Pantry finds the search where it was.
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const search = (next: string) => setParams(next ? { q: next } : {}, { replace: true, state: location.state });
  const toPantry = () => switchTab('pantry', query.trim() ? `/pantry?q=${encodeURIComponent(query.trim())}` : '/pantry');

  const shown = matchingItems(pantry ?? [], query);
  return (
    <SettingsPage title="Choose an item">
      <input className="field" type="search" placeholder="Search your Pantry" aria-label="Search your Pantry" value={query} onChange={e => search(e.target.value)} />
      {error && <Problem message={error} onRetry={reload} />}
      {!pantry && !error && <Loading />}
      {pantry && shown.length === 0 && (
        <div className="section stack">
          <p className="muted" style={{ margin: 0 }}>{query.trim() ? <>“{query.trim()}” isn’t in your Pantry.</> : 'Your Pantry is empty.'} Add it there first, then come back to set a goal.</p>
          <button type="button" className="button wide" onClick={toPantry}>Add it in the Pantry</button>
        </div>
      )}
      {shown.length > 0 && (
        <>
          <div className="setting-rows section">
            {shown.map(item => (
              <button key={item.id} type="button" className="setting-row" onClick={() => open(`/settings/stock-up/${item.id}`)}>
                <span className="grow">
                  <span className="setting-title">{item.name}</span>
                  <span className="setting-value">{itemNote(item)}</span>
                </span>
                <ChevronRight size={20} className="chevron" />
              </button>
            ))}
          </div>
          <p className="form-field-help">Not here? <button type="button" className="link-button" onClick={toPantry}>Add it in the Pantry first</button></p>
        </>
      )}
    </SettingsPage>
  );
}
