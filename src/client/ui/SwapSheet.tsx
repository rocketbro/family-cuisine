// Change one planned meal without leaving the day: another day for it, a roll of the dice, another recipe, recent leftovers, or a note.
// A meal that's only a name can become a recipe from here too.
import { useState } from 'react';
import { addDays, weekdayName, type ISODate } from '../../domain/dates.ts';
import type { CameOffMeal } from '../../domain/came-off.ts';
import type { MealSlot } from '../../domain/recipe.ts';
import type { MealChoice } from '../../shared/api-types.ts';
import { api } from '../api.ts';
import { announceChange } from '../data-events.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { useWrite } from '../hooks/useWrite.ts';
import { Loading, Problem } from './Common.tsx';
import { MoveMeal } from './MoveMeal.tsx';
import { RecipePicker } from './RecipePicker.tsx';
import { RollDice } from './RollDice.tsx';
import { Sheet } from './Sheet.tsx';
import { WriteUp } from './WriteUp.tsx';

export function SwapSheet({ date, slot, note: planned, moveTitle, onCameOff, onClose }: {
  date: ISODate; slot: MealSlot; note: string | null;
  /** The meal's name when it can still go to another day. */
  moveTitle: string | null;
  onCameOff: (meal: CameOffMeal) => void;
  onClose: () => void;
}) {
  const { data, error, reload } = useLoad(`swap:${date}`, () => Promise.all([api.recipes(), api.plan(addDays(date, -3), addDays(date, -1))]));
  const [note, setNote] = useState('');
  const write = useWrite();

  const choose = async (choice: MealChoice) => {
    const { cameOff } = await api.setMeal(date, slot, choice);
    if (cameOff) onCameOff(cameOff);
    announceChange();
    onClose();
  };
  // The sheet stays open on a failure. RollDice shows its own, so it calls choose directly.
  const pick = (choice: MealChoice) => write.run(() => choose(choice));

  const batches = (data?.[1] ?? []).filter(e => e.leftoversOffered);

  return (
    <Sheet title={`Swap ${weekdayName(date)} ${slot}`} onClose={onClose}>
      {error && <Problem message={error} onRetry={reload} />}
      {write.problem && <p className="error" style={{ marginTop: 0 }}>{write.problem}</p>}
      {!data ? <Loading /> : (
        <>
          {moveTitle && <MoveMeal date={date} slot={slot} title={moveTitle} onMoved={onClose} />}
          {planned && <WriteUp date={date} slot={slot} title={planned} onDone={onClose} />}
          <RollDice date={date} slot={slot} onUse={draft => choose({ kind: 'drafted', draft })} />
          {batches.length > 0 && (
            <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {batches.map(e => (
                <button key={e.date} className="chip" onClick={() => pick({ kind: 'leftovers', leftoversOf: { date: e.date, slot: 'dinner' } })}>
                  Leftovers · {e.madeTitle}
                </button>
              ))}
            </div>
          )}
          <form className="row" style={{ marginBottom: 14 }} onSubmit={e => { e.preventDefault(); if (note.trim()) void pick({ kind: 'note', note }); }}>
            <input className="field" placeholder="Or something else: eating out, sandwiches…" value={note} onChange={e => setNote(e.target.value)} />
            {note.trim() && <button className="button">Set</button>}
          </form>
          <RecipePicker recipes={data[0]} slot={slot} date={date} onPick={r => pick({ kind: 'recipe', recipeSlug: r.slug })} />
        </>
      )}
    </Sheet>
  );
}
