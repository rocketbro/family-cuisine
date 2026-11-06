import { Mic } from 'lucide-react';
import { useState } from 'react';
import type { CarriedMeal, CheckinQuestions, UseQuestion } from '../../../domain/checkin.ts';
import { weekdayName, type ISODate } from '../../../domain/dates.ts';
import type { UseAnswer } from '../../../domain/drafted-meal.ts';
import { slotWord } from '../../../domain/plan-slot.ts';
import type { PantryReport } from '../../../shared/api-types.ts';
import { useDictation } from '../../dictation/useDictation.ts';

type Answer = 'fine' | 'low' | 'out';

const USE_ANSWERS: { answer: UseAnswer; label: string }[] = [
  { answer: 'unused', label: 'Not used' },
  { answer: 'have', label: 'Still have' },
  { answer: 'low', label: 'Low' },
  { answer: 'out', label: 'Out' },
];
const answerKey = (q: UseQuestion) => `${q.date}:${q.slot}:${q.pantryItemId}`;

export function PantryStep({ date, questions, carried, saving, onSubmit }: {
  date: ISODate; questions: CheckinQuestions; carried: CarriedMeal[]; saving: boolean;
  onSubmit: (r: PantryReport) => void;
}) {
  const dictation = useDictation();
  const [uses, setUses] = useState<Record<string, UseAnswer>>({});
  const [used, setUsed] = useState<Record<number, number>>(Object.fromEntries(questions.counts.map(q => [q.pantryItemId, q.estimate])));
  const [needs, setNeeds] = useState<Record<number, Answer>>({});

  return (
    <div>
      {carried.length > 0 && (
        <p className="section muted">Also counting {carried.map(m => `${weekdayName(m.date)}’s ${slotWord(m.slot)} (${m.title})`).join(', ')}, which hasn’t come off the pantry yet.</p>
      )}
      {questions.uses.length > 0 && (
        <section className="section">
          <span className="eyebrow">What the meal used</span>
          <div className="list">
            {questions.uses.map(q => (
              <div key={answerKey(q)} className="list-row" style={{ flexWrap: 'wrap' }}>
                <span className="grow">{q.name}<div className="faint small">{q.text}</div></span>
                <span className="row" style={{ gap: 4 }}>
                  {USE_ANSWERS.map(({ answer, label }) => (
                    <button
                      key={answer}
                      className="chip"
                      aria-pressed={(uses[answerKey(q)] ?? q.answer) === answer}
                      onClick={() => setUses({ ...uses, [answerKey(q)]: answer })}
                    >
                      {label}
                    </button>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <button
            className="link-button"
            style={{ marginTop: 8 }}
            disabled={dictation.phase !== 'idle'}
            onClick={() => dictation.start({ kind: 'checkin', date }, 'What was different?')}
          >
            <Mic size={15} /> Something was different
          </button>
        </section>
      )}

      {questions.counts.length > 0 && (
        <section className="section">
          <span className="eyebrow">How many did you use?</span>
          <div className="list">
            {questions.counts.map(q => (
              <div key={q.pantryItemId} className="list-row">
                <span className="grow">{q.name}<div className="faint small">{q.onHand} on hand</div></span>
                <span className="stepper">
                  <button aria-label="Fewer" onClick={() => setUsed({ ...used, [q.pantryItemId]: Math.max(0, (used[q.pantryItemId] ?? 0) - 1) })}>−</button>
                  <span>{used[q.pantryItemId] ?? 0}</span>
                  <button aria-label="More" onClick={() => setUsed({ ...used, [q.pantryItemId]: Math.min(q.onHand, (used[q.pantryItemId] ?? 0) + 1) })}>+</button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {questions.needs.length > 0 && (
        <section className="section">
          <span className="eyebrow">Do we need more?</span>
          <div className="list">
            {questions.needs.map(q => (
              <div key={q.pantryItemId} className="list-row" style={{ flexWrap: 'wrap' }}>
                <span className="grow">{q.name}<div className="faint small">used in {q.usedIn}</div></span>
                <span className="row" style={{ gap: 4 }}>
                  {(['fine', 'low', 'out'] as const).map(a => (
                    <button key={a} className="chip" aria-pressed={(needs[q.pantryItemId] ?? 'fine') === a} onClick={() => setNeeds({ ...needs, [q.pantryItemId]: a })}>
                      {a === 'fine' ? 'Still have' : a === 'low' ? 'Low' : 'Out'}
                    </button>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!questions.counts.length && !questions.needs.length && !questions.uses.length && <p className="section muted">Nothing to check. Nice.</p>}

      <button className="button wide section" disabled={saving} onClick={() => onSubmit({
        counts: questions.counts.map(q => ({ pantryItemId: q.pantryItemId, used: used[q.pantryItemId] ?? 0 })),
        needs: questions.needs.map(q => ({ pantryItemId: q.pantryItemId, answer: needs[q.pantryItemId] ?? 'fine' })),
        uses: questions.uses.map(q => ({ date: q.date, slot: q.slot, pantryItemId: q.pantryItemId, answer: uses[answerKey(q)] ?? q.answer })),
      })}>{saving ? 'Saving…' : 'Done'}</button>
    </div>
  );
}
