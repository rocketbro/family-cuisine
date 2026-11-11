// What's been said so far to the check-in's pantry questions, starting from what each one expects. The evening
// check-in and the sheet for one meal checked off on Today both ask them this way.
import { useState } from 'react';
import type { CheckinQuestions, UseQuestion } from '../../../domain/checkin.ts';
import type { UseAnswer } from '../../../domain/drafted-meal.ts';
import type { PantryReport } from '../../../shared/api-types.ts';

export type NeedAnswer = 'fine' | 'low' | 'out';

export const answerKey = (q: UseQuestion) => `${q.date}:${q.slot}:${q.pantryItemId}`;

export function usePantryAnswers(questions: CheckinQuestions) {
  const [uses, setUses] = useState<Record<string, UseAnswer>>({});
  const [used, setUsed] = useState<Record<number, number>>(Object.fromEntries(questions.counts.map(q => [q.pantryItemId, q.estimate])));
  const [needs, setNeeds] = useState<Record<number, NeedAnswer>>({});

  const report = (): PantryReport => ({
    counts: questions.counts.map(q => ({ pantryItemId: q.pantryItemId, used: used[q.pantryItemId] ?? 0 })),
    needs: questions.needs.map(q => ({ pantryItemId: q.pantryItemId, answer: needs[q.pantryItemId] ?? q.answer })),
    uses: questions.uses.map(q => ({ date: q.date, slot: q.slot, pantryItemId: q.pantryItemId, answer: uses[answerKey(q)] ?? q.answer })),
  });
  return { uses, setUses, used, setUsed, needs, setNeeds, report };
}

export type PantryAnswers = ReturnType<typeof usePantryAnswers>;

export const hasQuestions = (q: CheckinQuestions) => q.counts.length + q.needs.length + q.uses.length > 0;
