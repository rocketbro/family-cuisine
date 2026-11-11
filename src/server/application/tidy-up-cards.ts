// The questions waiting on Today: what the cards show, and what a tap does. A card is gone once it's answered or left,
// and what it was about is already remembered (`tidy-up.ts`), so it isn't asked again for a long time.
import type { ISODate } from '../../domain/dates.ts';
import { stillWaiting } from '../../domain/tidy-memory.ts';
import type { TidyUpView } from '../../shared/api-types.ts';
import type { Deps } from './deps.ts';
import { applyAction } from './tidy-up-actions.ts';
import { pendingQuestions, savePending, tidyLog } from './tidy-up-store.ts';
import { UserError } from './user-error.ts';

export function tidyUpView(deps: Deps, today: ISODate): TidyUpView {
  return {
    cards: stillWaiting(pendingQuestions(deps), today).map(p => ({ id: p.fingerprint, question: p.question, answers: p.answers.map(a => a.label) })),
    last: tidyLog(deps)[0] ?? null,
  };
}

function take(deps: Deps, id: string) {
  const all = pendingQuestions(deps);
  const card = all.find(p => p.fingerprint === id);
  if (!card) throw new UserError('That question has already been dealt with.', 404);
  savePending(deps, all.filter(p => p !== card));
  return card;
}

/** Applies what the answer is mapped to. A card whose answer can no longer be done is gone all the same. */
export function answerTidyQuestion(deps: Deps, id: string, answer: number): void {
  const card = take(deps, id);
  const chosen = card.answers[answer];
  if (!chosen) throw new UserError('That isn’t one of the answers.', 400);
  if (chosen.action) applyAction(deps, chosen.action);
}

/** The × on a card: leave it as it is. */
export function leaveTidyQuestion(deps: Deps, id: string): void {
  take(deps, id);
}
