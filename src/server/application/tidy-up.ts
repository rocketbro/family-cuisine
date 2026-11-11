// The tidy-up pass. The code layer fixes what has one right answer and logs it; with a key, Claude then reads the
// pre-computed candidates and may put a few questions on Today. Claude's answers are checked in code against the menu
// and never applied here: a person's tap does that (`tidy-up-cards.ts`).
import type { ISODate } from '../../domain/dates.ts';
import { tidyCandidates } from '../../domain/tidy-candidates.ts';
import { tidyFixes } from '../../domain/tidy-fixes.ts';
import { withRun, type TidyRun } from '../../domain/tidy-log.ts';
import { ASKED_QUIET_DAYS, PASSED_QUIET_DAYS, roomForQuestions, stillQuiet, stillWaiting, withQuiet } from '../../domain/tidy-memory.ts';
import { checkedQuestions, digestOf, type PendingQuestion } from '../../domain/tidy-questions.ts';
import type { Candidate, Fix, TidyInputs } from '../../domain/tidy-types.ts';
import type { Deps } from './deps.ts';
import { applyFixes } from './tidy-up-fixes.ts';
import { tidyInputs } from './tidy-up-inputs.ts';
import { pendingQuestions, quietFingerprints, saveQuiet, savePending, saveTidyLog, tidyLog } from './tidy-up-store.ts';

/** Candidates the model may be asked about: not waiting on Today, not answered or looked at lately. */
function worthAsking(deps: Deps, inputs: TidyInputs, pending: readonly PendingQuestion[]): Candidate[] {
  const leaveOut = new Set([...Object.keys(stillQuiet(quietFingerprints(deps), inputs.today)), ...pending.map(p => p.fingerprint)]);
  return tidyCandidates(inputs, leaveOut);
}

async function askClaude(deps: Deps, today: ISODate, candidates: Candidate[], limit: number): Promise<PendingQuestion[]> {
  if (!candidates.length || limit <= 0) return [];
  const said = await deps.ai.tidyUp({ today, candidates: digestOf(candidates) });
  return checkedQuestions(said, candidates, today, limit);
}

/** What a pass would do, changing nothing: for the script that reads it on a copy. */
export async function lookAtTidyUp(deps: Deps, today: ISODate): Promise<{ fixes: Fix[]; candidates: Candidate[]; questions: PendingQuestion[] }> {
  const inputs = tidyInputs(deps, today);
  const pending = stillWaiting(pendingQuestions(deps), today);
  const candidates = worthAsking(deps, inputs, pending);
  const questions = deps.ai.available() ? await askClaude(deps, today, candidates, roomForQuestions(pending)) : [];
  return { fixes: tidyFixes(inputs), candidates, questions };
}

function record(deps: Deps, run: TidyRun): void {
  saveTidyLog(deps, withRun(tidyLog(deps), run, run.on));
}

/** Safe to run again: fixes already made find nothing to fix, and a retry adds to the same log entry. */
export async function runTidyUp(deps: Deps, today: ISODate, key: ISODate): Promise<void> {
  const fixed = applyFixes(deps, tidyInputs(deps, today));
  record(deps, { key, on: today, fixed, asked: 0, askedClaude: false });
  if (fixed.length) deps.log(`tidy-up fixed ${fixed.length} thing(s)`);
  if (!deps.ai.available()) return;

  const inputs = tidyInputs(deps, today);
  // Questions about things that came right on their own, or lapsed, go away.
  const stillTrue = new Set(tidyCandidates(inputs, new Set(), Infinity).map(c => c.fingerprint));
  const pending = stillWaiting(pendingQuestions(deps), today).filter(p => stillTrue.has(p.fingerprint));
  savePending(deps, pending);

  const candidates = worthAsking(deps, inputs, pending);
  const questions = await askClaude(deps, today, candidates, roomForQuestions(pending));
  const asked = new Set(questions.map(q => q.fingerprint));
  savePending(deps, [...pending, ...questions]);
  const quiet = withQuiet(quietFingerprints(deps), [...asked], ASKED_QUIET_DAYS, today);
  saveQuiet(deps, withQuiet(quiet, candidates.map(c => c.fingerprint).filter(f => !asked.has(f)), PASSED_QUIET_DAYS, today));
  record(deps, { key, on: today, fixed: [], asked: questions.length, askedClaude: true });
  deps.log(`tidy-up asked ${questions.length} question(s) of ${candidates.length} candidate(s)`);
}
