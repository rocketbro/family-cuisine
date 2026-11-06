// The few things worth building up, in the order money goes to them. Any room in the budget buys
// these on the grocery list. Tap one to change it; adding starts from the pantry.
import { ArrowDown, ArrowUp, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { packageForGoal } from '../../../../domain/stock-up.ts';
import type { StockGoalView } from '../../../../shared/api-types.ts';
import { api } from '../../../api.ts';
import { announceChange } from '../../../data-events.ts';
import { useLoad } from '../../../hooks/useLoad.ts';
import { useSaveState } from '../../../hooks/useSaveState.ts';
import { TabLink } from '../../../navigation/TabLink.tsx';
import { Loading } from '../../../ui/Common.tsx';
import { SaveNote } from '../../../ui/SaveNote.tsx';
import { SettingsPage } from '../SettingsPage.tsx';
import { asInput, movedGoal } from './goal-list.ts';
import { StockMeter } from './StockMeter.tsx';

export function StockUpScreen() {
  const { data: goals, reload } = useLoad('stock-up', () => api.stockUp());
  const [ordering, setOrdering] = useState(false);
  const save = useSaveState();

  const move = (id: number, by: -1 | 1) => save.run(async () => {
    const fresh = await api.stockUp();
    await api.setStockUp(movedGoal(fresh.map(asInput), id, by));
    announceChange();
    await reload();
  });

  return (
    <SettingsPage title="Stock up" intro="When the budget has room, the list buys these, starting from the top.">
      {!goals && <Loading />}
      {goals?.length === 0 && <p className="muted">Nothing yet. Pick something from your Pantry to build up a supply of it.</p>}
      {goals && goals.length > 0 && (
        <div className="setting-rows">
          {goals.map((goal, i) => ordering
            ? (
              <div key={goal.pantryItemId} className="setting-row">
                <span className="grow setting-title">{goal.name}</span>
                <span className="stock-order">
                  <button className="icon-button" aria-label={`Move ${goal.name} up`} disabled={i === 0 || save.phase === 'saving'} onClick={() => move(goal.pantryItemId, -1)}><ArrowUp size={20} /></button>
                  <button className="icon-button" aria-label={`Move ${goal.name} down`} disabled={i === goals.length - 1 || save.phase === 'saving'} onClick={() => move(goal.pantryItemId, 1)}><ArrowDown size={20} /></button>
                </span>
              </div>
            )
            : <GoalRow key={goal.pantryItemId} goal={goal} />)}
        </div>
      )}
      {goals && goals.length > 1 && (
        <button type="button" className="link-button" onClick={() => setOrdering(!ordering)}>{ordering ? 'Done changing the order' : 'Change the order'}</button>
      )}
      <SaveNote save={save} />
      {!ordering && (
        <div className="settings-actions">
          <TabLink to="/settings/stock-up/add" className="button"><Plus size={18} />Add from your Pantry</TabLink>
        </div>
      )}
    </SettingsPage>
  );
}

function GoalRow({ goal }: { goal: StockGoalView }) {
  // Without a size it can't tell how far a package goes, so the list adds one a trip.
  const noSize = packageForGoal({ packSize: goal.pack }, goal.goal) === null;
  return (
    <TabLink to={`/settings/stock-up/${goal.pantryItemId}`} className="setting-row">
      <span className="stock-grow">
        <span className="setting-title">{goal.name}</span>
        <StockMeter standing={goal.standing} />
        {noSize && <span className="stock-hint">Add its usual package</span>}
      </span>
      <ChevronRight size={20} className="chevron" />
    </TabLink>
  );
}
