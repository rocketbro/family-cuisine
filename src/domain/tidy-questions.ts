// What Claude says about the candidates, checked against what it was shown. Anything that doesn't hold is dropped.
import type { ISODate } from './dates.ts';
import { checkedAction, type SaidAction } from './tidy-actions.ts';
import type { Candidate, TidyAction } from './tidy-types.ts';

/** Few, because a person is asked each one. */
export const MAX_QUESTIONS_PER_RUN = 3;
export const MAX_ANSWERS = 3;
const MAX_QUESTION = 160;
const MAX_LABEL = 28;

export type SaidQuestion = { candidate: string; question: string; answers: { label: string; action: SaidAction | null }[] };

/** What is waiting on Today: the question, and what each answer does (null for "leave it as it is"). */
export type PendingQuestion = {
  fingerprint: string;
  question: string;
  answers: { label: string; action: TidyAction | null }[];
  askedOn: ISODate;
};

const plain = (text: string, max: number) => text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();

/** What the model sees for each candidate: a short id, since fingerprints are ours. */
export function digestOf(candidates: readonly Candidate[]) {
  return candidates.map((c, i) => ({
    id: `c${i + 1}`, about: c.kind, evidence: c.evidence, allowed: c.allowed,
    items: c.scope.items, entries: c.scope.entries, statuses: c.scope.statuses, names: c.scope.names,
  }));
}

export function checkedQuestions(said: readonly SaidQuestion[], candidates: readonly Candidate[], today: ISODate, limit = MAX_QUESTIONS_PER_RUN): PendingQuestion[] {
  const asked = new Set<string>();
  const kept: PendingQuestion[] = [];
  for (const q of said) {
    const index = /^c(\d+)$/.exec(q.candidate)?.[1];
    const candidate = index ? candidates[Number(index) - 1] : undefined;
    if (!candidate || asked.has(candidate.fingerprint) || kept.length >= limit) continue;
    const question = plain(q.question, MAX_QUESTION);
    const answers = q.answers.slice(0, MAX_ANSWERS).flatMap((a): PendingQuestion['answers'] => {
      const label = plain(a.label, MAX_LABEL);
      if (!label) return [];
      if (a.action === null || a.action.kind === 'dismiss') return [{ label, action: null }];
      const action = checkedAction(a.action, candidate);
      return action ? [{ label, action }] : [];
    });
    // A question nobody can act on isn't worth asking.
    if (!question || !answers.some(a => a.action)) continue;
    asked.add(candidate.fingerprint);
    kept.push({ fingerprint: candidate.fingerprint, question, answers, askedOn: today });
  }
  return kept;
}
