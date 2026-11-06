// Everything the plan was read as, by day, with what it would replace. Nothing is saved until the
// button at the bottom. Which week it means is an assumption, so that's at the top and can change.
import { useState } from 'react';
import { addDays, longDate, shortDate, type ISODate } from '../../../domain/dates.ts';
import { clashingSlots, importedDate, placementsToSave, type ImportedMeal } from '../../../domain/plan-import.ts';
import { isExtraSlot } from '../../../domain/plan-slot.ts';
import { nextTrip, tripCoversThrough, type ShopSchedule } from '../../../domain/shop-schedule.ts';
import type { PlanImportView } from '../../../shared/api-types.ts';
import type { PlanEntryView } from '../../../shared/views.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { useToday } from '../../hooks/useToday.ts';
import { useWrite } from '../../hooks/useWrite.ts';
import { ImportMealRow } from './ImportMealRow.tsx';
import { ImportMealSheet } from './ImportMealSheet.tsx';
import { ImportWeekChooser } from './ImportWeekChooser.tsx';

type Row = ImportedMeal & { key: number };

export function PlanImportReview({ view, shopping, onSaved, onStartOver }: {
  view: Extract<PlanImportView, { status: 'ready' }>; shopping: ShopSchedule; onSaved: () => Promise<void>; onStartOver: () => void;
}) {
  const today = useToday();
  const [rows, setRows] = useState<Row[]>(() => view.meals.map((meal, key) => ({ ...meal, key })));
  const [start, setStart] = useState<ISODate>(view.weekStart);
  const [editing, setEditing] = useState<number | null>(null);
  const write = useWrite();
  const { data: recipes } = useLoad('recipes', () => api.recipes());

  const dated = rows.map(row => ({ row, date: importedDate(row, start) }));
  const dates = dated.flatMap(({ date }) => date ?? []).sort();
  const from = dates[0] ?? start;
  const through = dates[dates.length - 1] ?? addDays(start, 6);
  const { data: planned } = useLoad(`import-plan:${from}:${through}`, () => api.plan(from, through));

  const toSave = placementsToSave(rows, start, today);
  const clashes = clashingSlots(toSave);
  const clashed = clashes.size > 0;
  const unplaced = dated.filter(d => d.date === null).length;
  const usesWeek = rows.some(r => r.date === null && r.weekday !== null);

  const existingAt = (date: ISODate | null, slot: Row['slot']): PlanEntryView | null =>
    (slot === 'extra' || !date ? null : planned?.find(e => e.date === date && e.slot === slot)) ?? null;

  const extrasAt = (date: ISODate | null, slot: Row['slot']): PlanEntryView[] =>
    (slot === 'extra' && date && planned?.filter(e => e.date === date && isExtraSlot(e.slot))) || [];

  const groups = [...new Set(dated.map(d => d.date))].sort((a, b) => (a ?? '').localeCompare(b ?? ''));
  const trip = nextTrip(today, shopping);
  const edited = rows.find(r => r.key === editing);

  const save = () => write.run(async () => {
    await api.confirmPlanImport(view.id, toSave);
    announceChange();
    await onSaved();
  });

  return (
    <div>
      <div className="notice section">
        {usesWeek ? <ImportWeekChooser start={start} today={today} shopping={shopping} onChange={setStart} /> : <p style={{ margin: 0 }}>The plan gives its own dates, so they stand as written.</p>}
        <p className="faint small" style={{ margin: '10px 0 0' }}>The next trip, {shortDate(trip)}, shops for meals through {shortDate(tripCoversThrough(trip, shopping))}. Anything planned before it has to come from what’s in the house.</p>
      </div>

      {groups.map(date => (
        <section key={date ?? 'none'} className="section">
          <span className="eyebrow">{date ? longDate(date) : 'Needs a day'}</span>
          <div className="list">
            {dated.filter(d => d.date === date).map(({ row }) => (
              <ImportMealRow
                key={row.key}
                meal={row}
                existing={existingAt(date, row.slot)}
                otherExtras={extrasAt(date, row.slot)}
                past={date !== null && date < today}
                clash={date !== null && clashes.has(`${date}:${row.slot}`)}
                onEdit={() => setEditing(row.key)}
                onRemove={() => setRows(rows.filter(r => r.key !== row.key))}
              />
            ))}
          </div>
        </section>
      ))}

      {!rows.length && <p className="section muted">Nothing left to save.</p>}
      {unplaced > 0 && <p className="section muted small">{unplaced === 1 ? 'One meal has' : `${unplaced} meals have`} no day yet, so {unplaced === 1 ? 'it won’t' : 'they won’t'} be saved until you choose one.</p>}
      {clashed && <p className="section error">Two meals are set for the same slot. Change or remove one, or make it an extra.</p>}
      {write.problem && <p className="section error">{write.problem}</p>}

      <button className="button wide section" disabled={!toSave.length || clashed} onClick={save}>
        Save {toSave.length} {toSave.length === 1 ? 'meal' : 'meals'} to the plan
      </button>
      <button className="link-button" style={{ marginTop: 10 }} onClick={onStartOver}>Start over</button>

      {edited && recipes && (
        <ImportMealSheet
          meal={edited}
          recipes={recipes}
          date={importedDate(edited, start)}
          start={start}
          today={today}
          onChange={meal => setRows(rows.map(r => (r.key === edited.key ? { ...meal, key: r.key } : r)))}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
