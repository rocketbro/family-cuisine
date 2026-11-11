// Everything the tidy-up might ask about, gathered with its evidence, minus what was asked recently.
import { likelyDuplicates } from './tidy-duplicates.ts';
import { unconfirmedLeftovers } from './tidy-leftovers.ts';
import { unmatchedIngredients } from './tidy-recipe-names.ts';
import { implausibleCounts, longPastUseBy, lowButBought } from './tidy-stock.ts';
import type { Candidate, CandidateKind, TidyInputs } from './tidy-types.ts';

/** Per kind, so one noisy check can't crowd out the rest, and the whole stays a short read for the model. */
const PER_KIND = 6;

export function tidyCandidates(inputs: TidyInputs, leaveOut: ReadonlySet<string>, perKind = PER_KIND): Candidate[] {
  const all = [
    ...likelyDuplicates(inputs), ...longPastUseBy(inputs), ...implausibleCounts(inputs), ...lowButBought(inputs),
    ...unmatchedIngredients(inputs), ...unconfirmedLeftovers(inputs),
  ].filter(c => !leaveOut.has(c.fingerprint));
  const seen = new Map<CandidateKind, number>();
  return all.filter(c => {
    const n = (seen.get(c.kind) ?? 0) + 1;
    seen.set(c.kind, n);
    return n <= perKind;
  });
}
