// Evenings nobody checked in. The next check-in asks about each, one tap a day, so the record doesn't drift.
import { CARRY_OVER_DAYS } from './checkin.ts';
import { addDays, type ISODate } from './dates.ts';
import { mealsOnly } from './plan-slot.ts';
import type { PlanEntry } from './plan.ts';

export type CatchUpFacts = {
  /** The day being checked in. */
  date: ISODate;
  today: ISODate;
  /** The first check-in on record. With none, there's nothing to catch up on. */
  began: ISODate | null;
  answered: (date: ISODate) => boolean;
};

/**
 * Days within the check-in's reach that still have meals nobody marked, latest first. An extra alone is no
 * reason to ask, since until someone says it was made it may just not have happened.
 */
export function daysToCatchUp(entries: readonly PlanEntry[], { date, today, began, answered }: CatchUpFacts): ISODate[] {
  if (!began || date > today) return [];
  const reach = addDays(date, -CARRY_OVER_DAYS);
  const from = reach > began ? reach : began;
  const days = mealsOnly(entries).filter(e => !e.outcome && e.date >= from && e.date < date).map(e => e.date);
  return [...new Set(days)].filter(day => !answered(day)).sort().reverse();
}
