// Says when the app took a meal off this day by itself: what changed, why, and the way to undo it.
import { X } from 'lucide-react';
import { mealOffLine } from '../../domain/meal-off.ts';
import type { ISODate } from '../../domain/dates.ts';
import type { MealSlot } from '../../domain/recipe.ts';
import { api } from '../api.ts';
import { announceChange } from '../data-events.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { useWrite } from '../hooks/useWrite.ts';

export function MealsOffNote({ date }: { date: ISODate; today?: ISODate }) {
  const { data } = useLoad(`meals-off:${date}`, () => api.mealsOff(date));
  const write = useWrite();
  if (!data?.length) return null;

  const run = (act: (slot: MealSlot) => Promise<unknown>, slot: MealSlot) =>
    void write.run(async () => { await act(slot); announceChange(); });

  return (
    <div className="section stack">
      {data.map(off => (
        <div key={off.slot} className="notice stack">
          <div className="spread">
            <div className="grow">{mealOffLine(off, off.replacement)}</div>
            <button className="icon-button" aria-label="Dismiss" onClick={() => run(slot => api.dismissMealOff(off.date, slot), off.slot)}>
              <X size={18} />
            </button>
          </div>
          <button className="button quiet wide" onClick={() => run(slot => api.putMealBack(off.date, slot), off.slot)}>
            Put back on the plan
          </button>
        </div>
      ))}
      {write.problem && <p className="error">{write.problem}</p>}
    </div>
  );
}
