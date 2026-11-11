// Everything the plan was read as, a day to a screen. Nothing is saved until the button, which stays
// in reach on every page and says what's in the way.
import { useEffect, useRef, useState } from 'react';
import { shortDate, weekdayName, type ISODate } from '../../../domain/dates.ts';
import { chooseMeal, firstChangedDate, saveBlocker, withoutMeal } from '../../../domain/plan-import-choices.ts';
import { reviewDays } from '../../../domain/plan-import-days.ts';
import { placementsToSave } from '../../../domain/plan-import.ts';
import type { PlanImportView } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { useToday } from '../../hooks/useToday.ts';
import { useWrite } from '../../hooks/useWrite.ts';
import { ImportMealSheet } from './ImportMealSheet.tsx';
import { PlanImportDay, type ReviewRow } from './PlanImportDay.tsx';
import { PlanImportPager } from './PlanImportPager.tsx';
import { PlanImportSaveBar } from './PlanImportSaveBar.tsx';
import { NO_DAY_PAGE, usePlanImportPager } from './usePlanImportPager.ts';
import { usePlanRevision } from './usePlanRevision.ts';

export function PlanImportReview({ view, onSaved, onStartOver }: {
  view: Extract<PlanImportView, { status: 'ready' }>; onSaved: () => Promise<void>; onStartOver: () => void;
}) {
  const today = useToday();
  const { range, claudesIdeas } = view;
  const [rows, setRows] = useState<ReviewRow[]>(() => view.meals.map((meal, key) => ({ ...meal, key })));
  const [editing, setEditing] = useState<number | null>(null);
  const [note, setNote] = useState<{ words: string; undo: ReviewRow[] } | null>(null);
  const pendingShow = useRef<ISODate | null>(null);
  const write = useWrite();
  const { data: status } = useLoad('status', () => api.status());
  const { data: recipes } = useLoad('recipes', () => api.recipes());

  const mealDates = rows.flatMap(row => row.date ?? []);
  const days = reviewDays(range, mealDates, today);
  const from = [range.from, ...mealDates].sort()[0];
  const through = [range.through, ...mealDates].sort().at(-1)!;
  const { data: planned } = useLoad(`import-plan:${from}:${through}`, () => api.plan(from, through));
  const plannedOn = (date: ISODate | null) => planned?.filter(entry => entry.date === date) ?? [];
  const made = (row: ReviewRow) => row.slot !== 'extra' && plannedOn(row.date).some(e => e.slot === row.slot && e.outcome);

  const saving = rows.filter(row => row.date !== null && row.date >= today && !made(row));
  const blocker = saveBlocker(saving, rows);
  const edited = rows.find(row => row.key === editing);

  const pages: (ISODate | null)[] = rows.some(row => row.date === null) ? [...days, null] : days;
  const pager = usePlanImportPager(pages.map(date => date ?? NO_DAY_PAGE));

  const onDate = pages[pager.index] ?? null;
  const revision = usePlanRevision({
    id: view.id,
    meals: rows.map(({ key: _key, ...meal }) => meal),
    onDate,
    onRevised: (meals, words) => {
      const before = rows;
      const nextKey = Math.max(-1, ...rows.map(row => row.key)) + 1;
      setRows(meals.map((meal, i) => ({ ...meal, key: nextKey + i })));
      setNote({ words: words || 'Done.', undo: before });
      const changed = firstChangedDate(before, meals);
      if (changed) pendingShow.current = changed;
    },
  });
  // The page for a day that's only just appeared doesn't exist until this render's done.
  useEffect(() => {
    if (pendingShow.current) pager.show(pendingShow.current);
    pendingShow.current = null;
  });

  const save = () => write.run(async () => {
    await api.confirmPlanImport(view.id, placementsToSave(saving, today));
    announceChange();
    await onSaved();
  });

  return (
    <div className="plan-review">
      {pages.length > 0 ? (
        <PlanImportPager
          pager={pager}
          pages={pages.map(date => ({
            key: date ?? NO_DAY_PAGE,
            label: date ? `${weekdayName(date).slice(0, 3)}, ${shortDate(date)}` : 'Needs a day',
            content: (
              <PlanImportDay
                date={date}
                rows={rows.filter(row => row.date === date)}
                planned={plannedOn(date)}
                today={today}
                onEdit={setEditing}
                onRemove={key => setRows(withoutMeal(rows, key))}
                onUse={key => setRows(chooseMeal(rows, key))}
              />
            ),
          }))}
        />
      ) : <p className="plan-day-empty plan-review-empty">Nothing left to save.</p>}

      <PlanImportSaveBar
        count={saving.length} blocker={blocker} problem={write.problem}
        note={note && { words: note.words, onUndo: () => { setRows(note.undo); setNote(null); } }}
        teller={status?.ai ? { asking: revision.asking, underway: revision.underway, free: revision.micFree, listen: () => void revision.listen() } : null}
        onSave={save} onShow={pager.show} onStartOver={onStartOver} />

      {edited && recipes && (
        <ImportMealSheet
          meal={edited}
          recipes={claudesIdeas ? recipes : recipes.filter(r => !r.claudesPick)}
          range={range}
          today={today}
          onChange={meal => setRows(rows.map(row => (row.key === edited.key ? { ...meal, key: row.key } : row)))}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
