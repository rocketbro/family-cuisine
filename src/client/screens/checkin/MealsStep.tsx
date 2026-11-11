// "What did we eat?" Most days it's what was planned, so that's the main button. Each meal can be marked with a tap, or say it:
// "yes to the eggs, we had the soup, but dinner was red beans and rice." The planned meals and the
// recipe book stay on screen to jog your memory.
import { Check, Keyboard, Mic } from 'lucide-react';
import { useState } from 'react';
import type { ISODate } from '../../../domain/dates.ts';
import { isExtraSlot } from '../../../domain/plan-slot.ts';
import type { PlanEntryView, RecipeCard } from '../../../shared/views.ts';
import { useDictation } from '../../dictation/useDictation.ts';
import { RecipePicker } from '../../ui/RecipePicker.tsx';
import { MealRow } from './MealRow.tsx';

type Props = { date: ISODate; meals: PlanEntryView[]; recipes: RecipeCard[]; saving: boolean; onAsPlanned: () => void };

export function MealsStep({ date, meals, recipes, saving, onAsPlanned }: Props) {
  const dictation = useDictation();
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const context = { kind: 'checkin' as const, date };
  const label = 'What we ate: scroll the book as you go';
  const hasExtras = meals.some(m => isExtraSlot(m.slot) && !m.outcome);
  const allMarked = meals.every(m => m.outcome);
  const idle = dictation.phase === 'idle';
  const speak = () => dictation.start(context, label);

  return (
    <div>
      <section className="section">
        <span className="eyebrow">What was planned</span>
        <div className="list">
          {meals.map(meal => <MealRow key={meal.slot} date={date} meal={meal} />)}
          {!meals.length && <p className="muted" style={{ margin: '12px 0' }}>Nothing was planned for this day.</p>}
        </div>
        {meals.length > 0 && idle && !typing && (
          <div className="row" style={{ marginTop: 8, gap: 16 }}>
            <button className="link-button" onClick={speak}>Say what you ate instead</button>
            <button className="link-button" onClick={() => setTyping(true)}>Type it</button>
          </div>
        )}
      </section>

      {typing && (
        <form className="section stack" onSubmit={e => { e.preventDefault(); if (text.trim()) void dictation.send(text, context, label).then(() => setText('')); }}>
          <textarea
            className="field"
            autoFocus
            placeholder="Eggs and toast, PB&J for lunch, and we had red beans and rice instead of the soup."
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <button className="button wide" disabled={!text.trim() || dictation.phase !== 'idle'}>Send</button>
        </form>
      )}

      <section className="section">
        <span className="eyebrow">In the book</span>
        <RecipePicker recipes={recipes} />
      </section>

      {idle && !typing && (
        <div className="sticky-actions">
          {meals.length > 0 ? (
            <button className="button wide" disabled={saving} onClick={onAsPlanned}><Check size={18} /> {allMarked ? 'Continue' : hasExtras ? 'We ate what was planned, extras too' : 'We ate what was planned'}</button>
          ) : (
            <>
              <button className="button wide" onClick={speak}><Mic size={18} /> Say what you ate</button>
              <button className="button quiet" aria-label="Type instead" onClick={() => setTyping(true)}><Keyboard size={18} /></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
