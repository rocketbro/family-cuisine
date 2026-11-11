// What opens when a meal is checked off on Today: the evening check-in's questions for just this meal. Done saves
// the answers; closing any other way leaves them for the check-in, which asks whatever is still open.
import type { ISODate } from '../../../domain/dates.ts';
import { slotLabel, type PlanSlot } from '../../../domain/plan-slot.ts';
import type { MealQuestions } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useWrite } from '../../hooks/useWrite.ts';
import { Sheet } from '../../ui/Sheet.tsx';
import { AnyLeft } from './AnyLeft.tsx';
import { PantryQuestions } from './PantryQuestions.tsx';
import { hasQuestions, usePantryAnswers } from './usePantryAnswers.ts';

type Props = { date: ISODate; slot: PlanSlot; title: string; asked: MealQuestions; onClose: () => void };

const TITLES = { needs: 'Still have these?' };

export function MealDoneSheet({ date, slot, title, asked, onClose }: Props) {
  const answers = usePantryAnswers(asked.questions);
  const write = useWrite();
  const questions = hasQuestions(asked.questions);
  const done = async () => {
    if (questions && !(await write.run(async () => { await api.recordMealPantry(date, slot, answers.report()); announceChange(); }))) return;
    onClose();
  };
  return (
    <Sheet title={`${slotLabel(slot)} done`} onClose={onClose} footer={(
      <div className="stack">
        <button className="button wide" onClick={() => void done()}>Done</button>
        <button className="link-button" style={{ justifySelf: "center" }} onClick={onClose}>Not now</button>
      </div>
    )}>
      <p className="muted" style={{ margin: '0 0 4px' }}>{title}</p>
      {asked.anyLeft && <AnyLeft date={date} answer={asked.anyLeft.answer} />}
      <PantryQuestions questions={asked.questions} answers={answers} titles={TITLES} hideSource />
      {write.problem && <p className="error">{write.problem}</p>}
    </Sheet>
  );
}
