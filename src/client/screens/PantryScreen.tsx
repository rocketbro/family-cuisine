// The pantry, kept roughly right: tap to cycle have → low → out, step counts for eggs and
// cans, or just talk through the kitchen. Categories fold away; searching opens them all.
import { useState } from 'react';
import type { PantryItem } from '../../domain/pantry.ts';
import { goingOffSoon } from '../../domain/use-by.ts';
import { api } from '../api.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { Loading, Problem } from '../ui/Common.tsx';
import { Clock, Mic } from 'lucide-react';
import { useDictation } from '../dictation/useDictation.ts';
import { useCollapsed } from '../hooks/useCollapsed.ts';
import { useToday } from '../hooks/useToday.ts';
import { FridgeList } from './pantry/FridgeList.tsx';
import { CategorySection } from './pantry/CategorySection.tsx';
import { ItemDetailsSheet } from './pantry/ItemDetailsSheet.tsx';
import { keepOpenRow } from './pantry/open-row.ts';
import { PantryRow } from './pantry/PantryRow.tsx';
import { usePantryWrites } from './pantry/usePantryWrites.ts';
import { useSearchFromLink } from './pantry/useSearchFromLink.ts';

const ADD_FORM = 'add';
const DETAILS = 'details';
const SOON = 'soon-';

export function PantryScreen() {
  const { data, error, reload } = useLoad('pantry', () => api.pantry());
  const dictation = useDictation();
  const folds = useCollapsed('pantry');
  const { items: list, problem, patch, add: addItem, remove } = usePantryWrites(data, reload);
  const today = useToday();
  const [query, setQuery] = useState(useSearchFromLink());
  // A row can show twice (Use soon and its category), so "soon-3" and "3" open separately.
  const [editing, setEditing] = useState<string | null>(null);
  const [soonSpot, setSoonSpot] = useState(0);
  // Kept here, not on the row: changing the category moves the row, and the sheet stays.
  const [detailsOf, setDetailsOf] = useState<number | null>(null);
  const details = list?.find(i => i.id === detailsOf) ?? null;

  const add = async () => {
    if (query.trim() && await addItem(query.trim(), ADD_FORM)) setQuery('');
  };

  const shown = (list ?? []).filter(i => !query || i.name.toLowerCase().includes(query.toLowerCase()));
  const groups = [...new Set(shown.map(i => i.category))];
  const openSoon = !query && editing?.startsWith(SOON) ? list?.find(i => `${SOON}${i.id}` === editing) ?? null : null;
  const soon = query ? [] : keepOpenRow(goingOffSoon(list ?? [], today), openSoon, soonSpot);
  const row = (item: PantryItem, key: string) => (
    <PantryRow key={key} item={item} today={today} editing={editing === key}
      onEdit={() => { setSoonSpot(soon.findIndex(i => `${SOON}${i.id}` === key)); setEditing(editing === key ? null : key); }}
      problem={problem?.where === key ? <Problem message={problem.message} onRetry={problem.retry} /> : null}
      onChange={change => patch(item, change, key)}
      onSeeAll={() => setDetailsOf(item.id)} />
  );

  return (
    <div className="page wide">
      <div className="spread title-row">
        <h1>Pantry</h1>
        <button
          className="icon-button"
          aria-label="Talk it through"
          disabled={dictation.phase !== 'idle'}
          onClick={() => dictation.start({ kind: 'pantry' }, 'Pantry: say what you see, scroll as you go')}
        >
          <Mic size={23} />
        </button>
      </div>

      <FridgeList />

      <form className="row" style={{ marginTop: 18 }} onSubmit={e => { e.preventDefault(); void add(); }}>
        <input className="field" placeholder="Find or add an item" value={query} onChange={e => setQuery(e.target.value)} />
        {query.trim() && !shown.some(i => i.name.toLowerCase() === query.trim().toLowerCase()) && <button className="button">Add</button>}
      </form>

      {problem?.where === ADD_FORM && <Problem message={problem.message} onRetry={problem.retry} />}
      {error && <Problem message={error} onRetry={reload} />}
      {!list ? <Loading /> : (
        <div className="pantry-groups">
          {soon.length > 0 && (
            <section className="section category">
              <div className="category-head">
                <Clock size={18} />
                <span className="eyebrow grow">Use soon</span>
                <span className="faint small">{soon.length}</span>
              </div>
              <div className="list">{soon.map(item => row(item, `${SOON}${item.id}`))}</div>
            </section>
          )}
          {groups.map(group => {
            const items = shown.filter(i => i.category === group);
            return (
              <CategorySection key={group} name={group} items={items} collapsed={!query && folds.isCollapsed(group)} onToggle={() => folds.toggle(group)}>
                {items.map(item => row(item, String(item.id)))}
              </CategorySection>
            );
          })}
        </div>
      )}

      {details && (
        <ItemDetailsSheet
          item={details}
          onClose={() => setDetailsOf(null)}
          onChange={change => patch(details, change, DETAILS)}
          onRemove={async () => { if (await remove(details, DETAILS)) { setDetailsOf(null); setEditing(null); } }}
          problem={problem?.where === DETAILS ? <Problem message={problem.message} onRetry={problem.retry} /> : null}
        />
      )}
    </div>
  );
}
