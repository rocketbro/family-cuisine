// What each day on the list would mean for a meal, so a row can say it before anyone taps.
import type { ISODate } from './dates.ts';
import { mealMove, moveRefusal, type MoveFrom, type MoveRefusal } from './meal-move.ts';
import { stillOnlyPlanned, type PlanEntry } from './plan.ts';

export type MoveOption<E extends PlanEntry = PlanEntry> = {
  date: ISODate;
  /** Why this day can't be chosen. */
  refused: MoveRefusal | null;
  /** The meal on that day, which trades places, or which comes off when it's a meal going back on. */
  other: E | null;
  /** Leftovers that come off because of it. */
  leftoversOff: E[];
};

const on = <E extends PlanEntry>(entries: readonly E[], date: ISODate, slot: string): E | null => entries.find(e => e.date === date && e.slot === slot) ?? null;

export function moveOptions<E extends PlanEntry>(entries: readonly E[], from: MoveFrom, days: readonly ISODate[], today: ISODate): MoveOption<E>[] {
  return days.map(date => {
    const refused = moveRefusal(entries, from, date, today);
    const leftoversOff = refused ? [] : mealMove(entries, from, date).off as E[];
    return { date, refused, other: on(entries, date, from.slot), leftoversOff };
  });
}

/** For a meal that already came off: nothing trades, what's there comes off in turn, and a recorded meal stays. */
export function putBackOptions<E extends PlanEntry>(entries: readonly E[], slot: string, days: readonly ISODate[]): MoveOption<E>[] {
  return days.map(date => {
    const other = on(entries, date, slot);
    return { date, refused: other && !stillOnlyPlanned(other) ? 'other-happened' : null, other, leftoversOff: [] };
  });
}
