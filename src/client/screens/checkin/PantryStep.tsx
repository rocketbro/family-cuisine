import { Mic } from 'lucide-react';
import type { CarriedMeal, CheckinQuestions } from '../../../domain/checkin.ts';
import { weekdayName, type ISODate } from '../../../domain/dates.ts';
import { slotWord } from '../../../domain/plan-slot.ts';
import type { PantryReport } from '../../../shared/api-types.ts';
import { useDictation } from '../../dictation/useDictation.ts';
import { PantryQuestions } from './PantryQuestions.tsx';
import { hasQuestions, usePantryAnswers } from './usePantryAnswers.ts';

export function PantryStep({ date, questions, carried, askingLeft, saving, onSubmit }: {
  date: ISODate; questions: CheckinQuestions; carried: CarriedMeal[]; askingLeft: boolean; saving: boolean;
  onSubmit: (r: PantryReport) => void;
}) {
  const dictation = useDictation();
  const answers = usePantryAnswers(questions);

  return (
    <div>
      {carried.length > 0 && (
        <p className="section muted">Also counting {carried.map(m => `${weekdayName(m.date)}’s ${slotWord(m.slot)} (${m.title})`).join(', ')}, which hasn’t come off the pantry yet.</p>
      )}
      <PantryQuestions questions={questions} answers={answers} />
      {questions.uses.length > 0 && (
        <button
          className="link-button"
          style={{ marginTop: 8 }}
          disabled={dictation.phase !== 'idle'}
          onClick={() => dictation.start({ kind: 'checkin', date }, 'What was different?')}
        >
          <Mic size={15} /> Something was different
        </button>
      )}

      {!askingLeft && !hasQuestions(questions) && <p className="section muted">Nothing to check. Nice.</p>}

      <button className="button wide section" disabled={saving} onClick={() => onSubmit(answers.report())}>{saving ? 'Saving…' : 'Done'}</button>
    </div>
  );
}
