// Stock that looks wrong for what's in the house: a date long gone, a count that can't be right, something marked low or out
// that's bought every trip.
import { addDays } from './dates.ts';
import { dateWording } from './use-by.ts';
import type { Candidate, TidyInputs } from './tidy-types.ts';

/** Past this many days a date on something still marked as in the house is probably forgotten, not a decision. */
export const LONG_PAST_DAYS = 7;
/** A count at or above this is more than a household keeps of anything countable (four dozen). */
export const IMPLAUSIBLE_COUNT = 48;
/** Low or out, and bought on this many trips running. */
export const TRIPS_RUNNING = 3;

const single = (item: { id: number; name: string }) => ({ items: [{ id: item.id, name: item.name }], entries: [], names: [] });

export function longPastUseBy({ pantry, today }: Pick<TidyInputs, 'pantry' | 'today'>): Candidate[] {
  return pantry
    .filter(i => i.status !== 'out' && i.useBy && i.useBy < addDays(today, -LONG_PAST_DAYS))
    .map(i => ({
      fingerprint: `use-by:${i.id}:${i.useBy}`,
      kind: 'stale_use_by' as const,
      evidence: [`"${i.name}" is marked ${i.status} with a use-by date of ${i.useBy}${i.useByEstimated ? ' (an estimate from how long it usually keeps)' : ''}, ${dateWording(i, today)}.`],
      allowed: ['clear_use_by', 'set_status'] as Candidate['allowed'],
      scope: { ...single(i), statuses: ['out'] as Candidate['scope']['statuses'] },
    }));
}

export function implausibleCounts({ pantry }: Pick<TidyInputs, 'pantry'>): Candidate[] {
  return pantry
    .filter(i => i.count !== null && i.count >= IMPLAUSIBLE_COUNT)
    .map(i => ({
      fingerprint: `count:${i.id}:${i.count}`,
      kind: 'odd_count' as const,
      evidence: [`"${i.name}" is counted, and the count is ${i.count}.`],
      allowed: ['set_count'] as Candidate['allowed'],
      scope: { ...single(i), statuses: [] },
    }));
}

export function lowButBought({ pantry, trips }: Pick<TidyInputs, 'pantry' | 'trips'>): Candidate[] {
  const recent = trips.slice(0, TRIPS_RUNNING);
  if (recent.length < TRIPS_RUNNING) return [];
  return pantry
    .filter(i => !i.staple && i.status !== 'have' && recent.every(t => t.onList.includes(i.id) && t.bought.includes(i.id)))
    .map(i => ({
      fingerprint: `bought-low:${i.id}`,
      kind: 'bought_though_low' as const,
      evidence: [`"${i.name}" is marked ${i.status}, and it was on the list and on a receipt for each of the last ${TRIPS_RUNNING} trips (${recent.map(t => t.shopDate).join(', ')}).`],
      allowed: ['set_status'] as Candidate['allowed'],
      scope: { ...single(i), statuses: ['have'] as Candidate['scope']['statuses'] },
    }));
}
