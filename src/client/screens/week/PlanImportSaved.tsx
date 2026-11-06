// The plan is on the calendar. Filling in the rest is a separate choice, and says what it will do.
import { useState } from 'react';
import { shortDate } from '../../../domain/dates.ts';
import { planHorizonEnd, type ShopSchedule } from '../../../domain/shop-schedule.ts';
import type { PlanImportView } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useToday } from '../../hooks/useToday.ts';
import { useWrite } from '../../hooks/useWrite.ts';
import { TabLink } from '../../navigation/TabLink.tsx';

export function PlanImportSaved({ view, aiOn, shopping, onAnother }: {
  view: Extract<PlanImportView, { status: 'saved' }>; aiOn: boolean; shopping: ShopSchedule; onAnother: () => void;
}) {
  const today = useToday();
  const [filling, setFilling] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const write = useWrite();
  const horizon = planHorizonEnd(today, shopping);

  const fill = async () => {
    setFilling(true);
    await write.run(async () => {
      const { added: count } = await api.planAhead();
      setAdded(count);
      announceChange();
    });
    setFilling(false);
  };

  return (
    <div className="stack section">
      <p style={{ margin: 0, fontSize: '1.15rem' }}>{view.saved} {view.saved === 1 ? 'meal' : 'meals'} on the plan, as your choices.</p>
      {view.leftAlone > 0 && <p className="muted" style={{ margin: 0 }}>{view.leftAlone} left out, because that meal was already made or the day had passed.</p>}

      <section className="notice">
        <span className="eyebrow">Fill in the rest?</span>
        <p style={{ margin: '6px 0 12px' }}>
          {aiOn ? 'Claude' : 'The simple planner'} would plan only the meals still open, from today through {shortDate(horizon)}. What you just saved stays, and so does anything else you chose. It can replace a meal it picked itself earlier, if the pantry no longer covers that one. It doesn’t add extras.
        </p>
        {added === null
          ? <button className="button wide" disabled={filling} onClick={fill}>{filling ? 'Planning…' : 'Fill in the rest'}</button>
          : <p style={{ margin: 0 }} role="status">{added === 0 ? 'Nothing was left to fill.' : `Added ${added} ${added === 1 ? 'meal' : 'meals'}. Days before the next trip only get what the pantry already covers, so some of those can stay open.`}</p>}
        {write.problem && <p className="error">{write.problem}</p>}
      </section>

      <TabLink to="/week" className="button quiet wide">See the week</TabLink>
      <button className="link-button" onClick={onAnother}>Import another plan</button>
    </div>
  );
}
