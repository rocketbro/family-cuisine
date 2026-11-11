// A day's extras, below its meals: each one like a meal card, and a quiet way to add another.
import { ArrowLeftRight, Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { beforeGroceries, type ShopSchedule } from '../../domain/shop-schedule.ts';
import { extrasOnly, isExtraSlot } from '../../domain/plan-slot.ts';
import type { ISODate } from '../../domain/dates.ts';
import type { PlanEntryView } from '../../shared/views.ts';
import { useToday } from '../hooks/useToday.ts';
import { Problem } from './Common.tsx';
import { ExtraSheet } from './ExtraSheet.tsx';
import { useMealDone } from '../screens/checkin/useMealDone.tsx';
import { DoneCheck, MealBody } from './MealCard.tsx';
import { NightBeforeNote } from './NightBeforeNote.tsx';
import { SwipeRow } from './SwipeRow.tsx';

export function ExtrasSection({ date, entries, schedule }: { date: ISODate; entries: PlanEntryView[]; schedule: ShopSchedule }) {
  const [adding, setAdding] = useState(false);
  const extras = extrasOnly(entries);
  return (
    <>
      {extras.length > 0 && <div className="meals">{extras.map(entry => <ExtraCard key={entry.slot} entry={entry} schedule={schedule} />)}</div>}
      <button className="link-button add-extra" onClick={() => setAdding(true)}><Plus size={14} /> {extras.length ? 'Add another extra' : 'Add an extra'}</button>
      {adding && <ExtraSheet date={date} onClose={() => setAdding(false)} />}
    </>
  );
}

function ExtraCard({ entry, schedule }: { entry: PlanEntryView; schedule: ShopSchedule }) {
  const [changing, setChanging] = useState(false);
  const today = useToday();
  const { done, toggle: toggleDone, write, sheet: doneSheet } = useMealDone(entry);
  const canCheck = entry.date <= today;
  // What's come off the pantry stays on the record, so there's nothing to change.
  const settled = entry.pantrySettled || entry.checkinSettled;
  const change = () => { if (!settled) setChanging(true); };
  const notOnList = !entry.outcome && entry.recipe && entry.recipe.availability.level !== 'ready' && beforeGroceries(entry.date, today, schedule);
  return (
    <section className={`section meal ${done ? 'done' : ''}`}>
      <div className="spread" style={{ marginBottom: 10 }}>
        <span className="eyebrow">Extra</span>
        {!settled && <button className="link-button phone-quiet" onClick={change}>Change</button>}
      </div>
      <SwipeRow onSwipeLeft={canCheck ? () => { void toggleDone(); } : undefined} onSwipeRight={change}
        leftMark={<Check size={22} strokeWidth={3} />} rightMark={<ArrowLeftRight size={22} />}>
        <div className="meal-card">
          <MealBody entry={entry} swap={change} />
          {canCheck && <DoneCheck slot={entry.slot} done={done} onToggle={toggleDone} />}
        </div>
      </SwipeRow>
      {doneSheet}
      <NightBeforeNote entry={entry} />
      {entry.kind === 'note' && !entry.outcome && <p className="faint small" style={{ margin: '8px 0 0' }}>No recipe yet, so nothing goes on the list or comes off the pantry for it.</p>}
      {notOnList && <p className="faint small" style={{ margin: '8px 0 0' }}>This comes before the next shopping trip, so what’s missing isn’t on that trip’s list.</p>}
      {write.problem && <Problem message={write.problem} onRetry={write.retry} />}
      {changing && isExtraSlot(entry.slot) && <ExtraSheet date={entry.date} changing={{ slot: entry.slot, note: entry.kind === 'note' ? entry.note : null }} onClose={() => setChanging(false)} />}
    </section>
  );
}
