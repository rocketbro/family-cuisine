// "Let's have this": put a recipe on today, tomorrow, or any day from the date picker.
import { useState } from 'react';
import { addDays, shortDate, weekdayName, type ISODate } from '../../../domain/dates.ts';
import { RECIPE_MEALS, type RecipeMeal } from '../../../domain/recipe.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useToday } from '../../hooks/useToday.ts';
import { Segmented } from '../../ui/Common.tsx';
import { Sheet } from '../../ui/Sheet.tsx';

/** One of the day's meals, or something extra on top of them. */

export function PlanSheet({ slug, meals, factor, onClose, onPlanned }: {
  slug: string; meals: RecipeMeal[]; factor: number; onClose: () => void;
  onPlanned: (date: ISODate, slot: RecipeMeal) => void;
}) {
  const today = useToday();
  const tomorrow = addDays(today, 1);
  const [date, setDate] = useState<ISODate>(today);
  const [slot, setSlot] = useState<RecipeMeal>(meals[meals.length - 1] ?? 'extra');
  const [error, setError] = useState<string | null>(null);
  const picked = date !== today && date !== tomorrow;

  const save = async () => {
    try {
      const choice = { kind: 'recipe' as const, recipeSlug: slug, multiplier: factor };
      await (slot === 'extra' ? api.addExtra(date, choice) : api.setMeal(date, slot, choice));
      announceChange();
      onPlanned(date, slot);
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <Sheet title="Plan this" onClose={onClose} footer={<button className="button wide" onClick={save}>Save</button>}>
      <div className="stack">
        <span className="eyebrow">Which day?</span>
        <div className="row" style={{ gap: 6 }}>
          <button className="chip" aria-pressed={date === today} onClick={() => setDate(today)}>Today</button>
          <button className="chip" aria-pressed={date === tomorrow} onClick={() => setDate(tomorrow)}>Tomorrow</button>
          {/* The real date input sits over the chip, so a tap opens the phone's own date picker. */}
          <label className="chip date-chip" aria-pressed={picked}>
            {picked ? `${weekdayName(date).slice(0, 3)}, ${shortDate(date)}` : 'Another day…'}
            <input type="date" min={today} value={date} aria-label="Pick a day" onChange={e => e.target.value && setDate(e.target.value)} />
          </label>
        </div>
        <span className="eyebrow">Which meal?</span>
        <Segmented label="Meal" value={slot} onChange={setSlot} options={RECIPE_MEALS.map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
        {slot === 'extra' && <p className="muted small" style={{ margin: 0 }}>On top of the day’s meals, which stay as they are.</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </Sheet>
  );
}
