// Checking a meal off on Today. Checking records it as made through the check-in's own path, then opens a short
// sheet of the check-in's questions for just that meal; unchecking takes the mark off and nothing else, since
// what the meal took off the pantry stays answered.
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { PlanSlot } from '../../../domain/plan-slot.ts';
import type { MealQuestions } from '../../../shared/api-types.ts';
import type { PlanEntryView } from '../../../shared/views.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useWrite } from '../../hooks/useWrite.ts';
import { entryTitle } from '../../ui/entry-title.ts';
import { MealDoneSheet } from './MealDoneSheet.tsx';
import { hasQuestions } from './usePantryAnswers.ts';

export const isDone = (entry: Pick<PlanEntryView, 'outcome'>) => entry.outcome === 'made' || entry.outcome === 'swapped';

export function useMealDone(entry: PlanEntryView): { done: boolean; toggle: () => Promise<boolean>; write: ReturnType<typeof useWrite>; sheet: ReactNode } {
  const write = useWrite();
  const [asking, setAsking] = useState<MealQuestions | null>(null);
  const done = isDone(entry);
  const { date, slot } = entry;
  const toggle = () => write.run(async () => {
    if (done) {
      await api.setMealDone(date, slot, false);
      announceChange();
      return;
    }
    await api.markMeal(date, slot, { outcome: 'made' });
    announceChange();
    const questions = await api.mealQuestions(date, slot);
    if (questions.anyLeft || hasQuestions(questions.questions)) setAsking(questions);
  });
  const sheet = asking && <MealDoneSheet date={date} slot={slot as PlanSlot} title={entryTitle(entry)} asked={asking} onClose={() => setAsking(null)} />;
  return { done, toggle, write, sheet };
}
