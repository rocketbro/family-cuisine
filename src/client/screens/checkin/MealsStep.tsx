// "What did we eat?" Say it: "yes to the eggs, we had the soup, but dinner was red beans
// and rice." The planned meals and the recipe book stay on screen to jog your memory.
import { Check, Keyboard, Mic } from 'lucide-react';
import { useState } from 'react';
import type { ISODate } from '../../../domain/dates.ts';
import { usesText } from '../../../domain/drafted-meal.ts';
import { isExtraSlot, slotLabel, type ExtraSlot } from '../../../domain/plan-slot.ts';
import type { PlanEntryView, RecipeCard } from '../../../shared/views.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useDictation } from '../../dictation/useDictation.ts';
import { useWrite } from '../../hooks/useWrite.ts';
import { entryTitle } from '../../ui/entry-title.ts';
import { RecipePicker } from '../../ui/RecipePicker.tsx';

type Props = { date: ISODate; meals: PlanEntryView[]; recipes: RecipeCard[]; saving: boolean; onAsPlanned: () => void };

export function MealsStep({ date, meals, recipes, saving, onAsPlanned }: Props) {
  const dictation = useDictation();
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const context = { kind: 'checkin' as const, date };
  const label = 'What we ate: scroll the book as you go';
  const write = useWrite();
  const hasExtras = meals.some(m => isExtraSlot(m.slot) && !m.outcome);

  return (
    <div>
      <section className="section">
        <span className="eyebrow">What was planned</span>
        <div className="list">
          {meals.map(meal => (
            <div key={meal.slot} className="list-row">
              <span className="grow">
                <span className="faint small">{slotLabel(meal.slot)}</span>
                <div style={{ fontSize: '1.15rem' }}>{entryTitle(meal)}</div>
                {meal.drafted && meal.drafted.uses.length > 0 && <div className="faint small">{meal.kind === 'recipe' ? 'Plus' : 'Uses'} {usesText(meal.drafted.uses)}</div>}
              </span>
              {isExtraSlot(meal.slot) && !meal.outcome && <button className="chip" onClick={() => {
                const slot = meal.slot as ExtraSlot;
                void write.run(async () => { await api.removeExtra(date, slot); announceChange(); });
              }}>Didn’t make it</button>}
              {meal.outcome && <span className="chip"><Check size={14} />&nbsp;{meal.outcome === 'made' ? 'Made' : meal.outcome === 'swapped' ? 'Swapped' : 'Skipped'}</span>}
            </div>
          ))}
          {!meals.length && <p className="muted" style={{ margin: '12px 0' }}>Nothing was planned for this day.</p>}
        </div>
        {meals.length > 0 && (
          <button className="link-button" style={{ marginTop: 8 }} disabled={saving} onClick={onAsPlanned}>{hasExtras ? 'We ate what was planned, extras too' : 'We ate what was planned'}</button>
        )}
        {write.problem && <p className="error">{write.problem}</p>}
      </section>

      <section className="section">
        <span className="eyebrow">In the book</span>
        <RecipePicker recipes={recipes} />
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

      {dictation.phase === 'idle' && !typing && (
        <div className="sticky-actions">
          <button className="button wide" onClick={() => dictation.start(context, label)}><Mic size={18} /> Tell us what we ate</button>
          <button className="button quiet" aria-label="Type instead" onClick={() => setTyping(true)}><Keyboard size={18} /></button>
        </div>
      )}
    </div>
  );
}
