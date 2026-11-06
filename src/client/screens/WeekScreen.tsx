// The week at a glance, Sunday through Saturday. Tap a day to see it in full.
import { useState } from 'react';
import { addDays, dateRange, monthDay, shortDate, weekdayName, weekStart, type ISODate } from '../../domain/dates.ts';
import { isExtraSlot, mealsOnly } from '../../domain/plan-slot.ts';
import { tripsBetween } from '../../domain/shop-schedule.ts';
import { TabLink } from '../navigation/TabLink.tsx';
import type { PlanEntryView } from '../../shared/views.ts';
import { api } from '../api.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { useToday } from '../hooks/useToday.ts';
import { useWrite } from '../hooks/useWrite.ts';
import { Loading, Problem } from '../ui/Common.tsx';
import { ChevronLeft, ChevronRight, ClipboardList, PiggyBank, Plus, ShoppingBasket } from 'lucide-react';
import { entryTitle } from '../ui/entry-title.ts';
import { ExtraSheet } from '../ui/ExtraSheet.tsx';
import { SaveMoneySheet } from './week/SaveMoneySheet.tsx';

export function WeekScreen() {
  const today = useToday();
  const [start, setStart] = useState(weekStart(today));
  const end = addDays(start, 6);
  const { data, error, reload } = useLoad(`week:${start}`, () => api.plan(start, end));
  const { data: status } = useLoad('status', () => api.status());
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingTo, setAddingTo] = useState<ISODate | null>(null);
  const planWrite = useWrite();
  const trips = new Set(status ? tripsBetween(start, end, status.shopping) : []);

  const byDate = new Map<string, PlanEntryView[]>();
  for (const entry of data ?? []) byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);
  const hasGaps = dateRange(start, end).some(d => d >= today && mealsOnly(byDate.get(d) ?? []).length !== 3);

  return (
    <div className="page">
      <div className="spread title-row">
        <h1 style={{ fontSize: '1.9rem' }}>{monthDay(start)} – {monthDay(end)}</h1>
        <div className="row">
          <button className="icon-button" aria-label="Previous week" onClick={() => setStart(addDays(start, -7))}><ChevronLeft size={22} /></button>
          <button className="icon-button" aria-label="Next week" onClick={() => setStart(addDays(start, 7))}><ChevronRight size={22} /></button>
        </div>
      </div>

      {error && <Problem message={error} onRetry={reload} />}
      {!data ? <Loading /> : (
        <div className="list section">
          {dateRange(start, end).map(date => (
            <div key={date} className="list-row" style={{ alignItems: 'flex-start', padding: '14px 0', opacity: date < today ? 0.55 : 1 }}>
              <TabLink to={`/day/${date}`} className="row grow" style={{ textDecoration: 'none', color: 'inherit', alignItems: 'flex-start' }}>
              <div style={{ width: 86, flex: 'none' }}>
                <div style={{ fontSize: '1.15rem' }}>{weekdayName(date).slice(0, 3)}{date === today ? ' ·' : ''}</div>
                <div className="faint small">{shortDate(date)}</div>
                {trips.has(date) && <div className="faint" style={{ marginTop: 4 }} title="Shopping day"><ShoppingBasket size={17} /></div>}
              </div>
              <div className="grow">
                {(byDate.get(date) ?? []).map(entry => (
                  <div key={entry.slot} className="row" style={{ gap: 8, lineHeight: 1.35, marginBottom: 2 }}>
                    <span className={`dot ${entry.recipe?.availability.level ?? 'have'}`} style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none' }} />
                    <span className={entry.slot === 'dinner' ? '' : 'muted'}>{isExtraSlot(entry.slot) ? 'Extra · ' : ''}{entryTitle(entry)}</span>
                  </div>
                ))}
                {!byDate.get(date)?.length && <span className="faint italic">Not planned yet</span>}
              </div>
              </TabLink>
              {date >= today && <button className="icon-button" style={{ color: 'var(--ink-faint)' }} aria-label={`Add an extra on ${weekdayName(date)}`} onClick={() => setAddingTo(date)}><Plus size={17} /></button>}
            </div>
          ))}
        </div>
      )}

      {hasGaps && (
        <button className="button quiet wide section" disabled={planning} onClick={async () => {
          setPlanning(true);
          await planWrite.run(async () => { await api.planAhead(); await reload(); });
          setPlanning(false);
        }}>{planning ? 'Planning…' : 'Plan the rest of this week'}</button>
      )}

      {planWrite.problem && <p className="error">{planWrite.problem}</p>}
      <TabLink to="/week/import" className="button quiet wide section"><ClipboardList size={18} /> Import a meal plan</TabLink>
      <button className="button quiet wide section" onClick={() => setSaving(true)}><PiggyBank size={18} /> Save money</button>
      {addingTo && <ExtraSheet date={addingTo} onClose={() => setAddingTo(null)} />}
      {saving && <SaveMoneySheet onClose={() => setSaving(false)} onChanged={() => { void reload(); }} />}
    </div>
  );
}
