// Changing one meal before it's saved: which day, which meal, and what it is.
import { useState } from 'react';
import { dateRange, shortDate, weekdayName, type ISODate } from '../../../domain/dates.ts';
import type { ImportedMeal, ImportMatch, ImportRange, ImportSlot } from '../../../domain/plan-import.ts';
import { MEAL_SLOTS } from '../../../domain/recipe.ts';
import type { RecipeCard } from '../../../shared/views.ts';
import { Segmented } from '../../ui/Common.tsx';
import { RecipePicker } from '../../ui/RecipePicker.tsx';
import { Sheet } from '../../ui/Sheet.tsx';

const capital = (word: string) => word[0].toUpperCase() + word.slice(1);
/** Past this many, the date picker does it better than a wall of chips. */
const MOST_DAY_CHIPS = 14;

export function ImportMealSheet({ meal, recipes, range, today, onChange, onClose }: {
  meal: ImportedMeal; recipes: RecipeCard[]; range: ImportRange; today: ISODate;
  onChange: (meal: ImportedMeal) => void; onClose: () => void;
}) {
  const { match, slot, date } = meal;
  const [mode, setMode] = useState<ImportMatch['kind']>(match.kind);
  const setDate = (chosen: ISODate) => onChange({ ...meal, date: chosen });
  const setSlot = (chosen: ImportSlot) => onChange({ ...meal, slot: chosen });
  const setMatch = (chosen: ImportMatch) => onChange({ ...meal, match: chosen, confidence: 'sure', slot: chosen.kind === 'leftovers' && slot === 'extra' ? 'lunch' : slot });
  const days = dateRange(range.from, range.through).filter(d => d >= today).slice(0, MOST_DAY_CHIPS);
  const slots: ImportSlot[] = match.kind === 'leftovers' ? MEAL_SLOTS : [...MEAL_SLOTS, 'extra'];
  // What it goes back to when it's a name again, after trying it as something else.
  const [named, setNamed] = useState(match.kind === 'named' ? match.name : match.kind === 'recipe' ? match.title : meal.said);
  const typed = (name: string) => {
    setNamed(name);
    setMatch({ kind: 'named', name });
  };
  // A meal needs some name, so clearing one puts back their words.
  const close = () => {
    if (match.kind === 'named' && !match.name.trim()) onChange({ ...meal, match: { kind: 'named', name: meal.said || 'Something easy' } });
    onClose();
  };

  return (
    <Sheet title={`“${meal.said}”`} onClose={close} footer={<button className="button wide" onClick={close}>Done</button>}>
      <div className="stack">
        <span className="eyebrow">Which day?</span>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {days.map(day => <button key={day} className="chip" aria-pressed={day === date} onClick={() => setDate(day)}>{weekdayName(day).slice(0, 3)} {shortDate(day).split(' ')[1]}</button>)}
          <label className="chip date-chip" aria-pressed={date !== null && !days.includes(date)}>
            {date !== null && !days.includes(date) ? shortDate(date) : 'Another day…'}
            <input type="date" min={today} value={date ?? range.from} aria-label="Pick a day" onChange={e => e.target.value && setDate(e.target.value)} />
          </label>
        </div>
        <span className="eyebrow">Which meal?</span>
        <Segmented tight label="Meal" value={slot} onChange={setSlot} options={slots.map(s => ({ value: s, label: capital(s) }))} />
        <span className="eyebrow">What is it?</span>
        <Segmented
          label="What it is"
          value={mode}
          onChange={kind => {
            setMode(kind);
            // A recipe needs choosing first; until then it stays what it was.
            if (kind === 'leftovers') setMatch({ kind });
            if (kind === 'named') setMatch({ kind, name: named });
          }}
          options={[{ value: 'named', label: 'A name' }, { value: 'recipe', label: 'Recipe' }, { value: 'leftovers', label: 'Leftovers' }]}
        />
        {match.kind === 'named' && mode === 'named' && (
          <input className="field" aria-label="What to call it" maxLength={120} value={match.name} onChange={e => typed(e.target.value)} />
        )}
        {mode === 'recipe' && (
          <>
            {match.kind === 'recipe' && <p style={{ margin: 0 }}>{match.title}</p>}
            <RecipePicker recipes={recipes} slot={slot} date={date ?? undefined} onPick={r => setMatch({ kind: 'recipe', slug: r.slug, title: r.title })} />
          </>
        )}
      </div>
    </Sheet>
  );
}
