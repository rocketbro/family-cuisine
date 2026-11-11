// The check-in's pantry questions, one list per kind. `PantryStep` shows them for the day, and the sheet that opens when a
// meal is checked off on Today shows them for that meal.
import type { CheckinQuestions } from '../../../domain/checkin.ts';
import type { UseAnswer } from '../../../domain/drafted-meal.ts';
import { answerKey, type NeedAnswer, type PantryAnswers } from './usePantryAnswers.ts';

const USE_ANSWERS: { answer: UseAnswer; label: string }[] = [
  { answer: 'unused', label: 'Not used' },
  { answer: 'have', label: 'Still have' },
  { answer: 'low', label: 'Low' },
  { answer: 'out', label: 'Out' },
];
const NEED_LABELS: Record<NeedAnswer, string> = { fine: 'Still have', low: 'Low', out: 'Out' };

type Props = { questions: CheckinQuestions; answers: PantryAnswers; /** The sheet for one meal already says which. */ hideSource?: boolean; titles?: { uses?: string; counts?: string; needs?: string } };

export function PantryQuestions({ questions, answers, hideSource, titles = {} }: Props) {
  const { uses, setUses, used, setUsed, needs, setNeeds } = answers;
  return (
    <>
      {questions.uses.length > 0 && (
        <section className="section">
          <span className="eyebrow">{titles.uses ?? 'What the meal used'}</span>
          <div className="list">
            {questions.uses.map(q => (
              <div key={answerKey(q)} className="list-row" style={{ flexWrap: 'wrap' }}>
                <span className="grow">{q.name}<div className="faint small">{q.text}</div></span>
                <span className="row" style={{ gap: 4 }}>
                  {USE_ANSWERS.map(({ answer, label }) => (
                    <button key={answer} className="chip" aria-pressed={(uses[answerKey(q)] ?? q.answer) === answer} onClick={() => setUses({ ...uses, [answerKey(q)]: answer })}>{label}</button>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {questions.counts.length > 0 && (
        <section className="section">
          <span className="eyebrow">{titles.counts ?? 'How many did you use?'}</span>
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
          <span className="eyebrow">{titles.needs ?? 'Do we need more?'}</span>
          <div className="list">
            {questions.needs.map(q => (
              <div key={q.pantryItemId} className="list-row" style={{ flexWrap: 'wrap' }}>
                <span className="grow">{q.name}{!hideSource && <div className="faint small">used in {q.usedIn}</div>}</span>
                <span className="row" style={{ gap: 4 }}>
                  {(['fine', 'low', 'out'] as const).map(a => (
                    <button key={a} className="chip" aria-pressed={(needs[q.pantryItemId] ?? q.answer) === a} onClick={() => setNeeds({ ...needs, [q.pantryItemId]: a })}>{NEED_LABELS[a]}</button>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
