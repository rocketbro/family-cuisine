// Adding something extra to a day, or changing one already there. A recipe puts its ingredients on
// the list; a plain name just holds the place until there's a recipe for it.
import { useState } from 'react';
import { weekdayName, type ISODate } from '../../domain/dates.ts';
import type { ExtraSlot } from '../../domain/plan-slot.ts';
import type { ExtraChoice } from '../../shared/api-types.ts';
import { api } from '../api.ts';
import { announceChange } from '../data-events.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { useWrite } from '../hooks/useWrite.ts';
import { Loading, Problem } from './Common.tsx';
import { RecipePicker } from './RecipePicker.tsx';
import { Sheet } from './Sheet.tsx';
import { WriteUp } from './WriteUp.tsx';

export function ExtraSheet({ date, changing, onClose }: {
  date: ISODate; changing?: { slot: ExtraSlot; note: string | null }; onClose: () => void;
}) {
  const { data, error, reload } = useLoad('recipes', () => api.recipes());
  const [note, setNote] = useState('');
  const write = useWrite();

  const save = (work: () => Promise<unknown>) => write.run(async () => {
    await work();
    announceChange();
    onClose();
  });
  const pick = (choice: ExtraChoice) => save(() => (changing ? api.changeExtra(date, changing.slot, choice) : api.addExtra(date, choice)));

  return (
    <Sheet title={changing ? `Change this ${weekdayName(date)} extra` : `Something extra on ${weekdayName(date)}`} onClose={onClose}>
      {error && <Problem message={error} onRetry={reload} />}
      {write.problem && <p className="error" style={{ marginTop: 0 }}>{write.problem}</p>}
      {!changing && <p className="muted small" style={{ marginTop: 0 }}>On top of the day’s meals. Its ingredients go on the list, and it comes off the pantry once it’s made. The planner leaves it alone.</p>}
      {changing && (
        <div className="stack" style={{ marginBottom: 14 }}>
          {changing.note && <WriteUp date={date} slot={changing.slot} title={changing.note} onDone={onClose} />}
          <button className="button quiet wide" onClick={() => save(() => api.removeExtra(date, changing.slot))}>Take it off this day</button>
        </div>
      )}
      <form className="row" style={{ marginBottom: 14 }} onSubmit={e => { e.preventDefault(); if (note.trim()) void pick({ kind: 'note', note }); }}>
        <input className="field" placeholder="Or just a name, with no recipe yet" value={note} onChange={e => setNote(e.target.value)} />
        {note.trim() && <button className="button">Set</button>}
      </form>
      {!data ? <Loading /> : <RecipePicker recipes={data} slot="extra" date={date} onPick={r => pick({ kind: 'recipe', recipeSlug: r.slug })} />}
    </Sheet>
  );
}
