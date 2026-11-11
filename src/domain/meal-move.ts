// Moving a meal to another day, same slot, trading places with whatever is there. The screen and the
// server work it out with the same functions, so what a row says is what the tap does.
import type { ISODate } from './dates.ts';
import { leftoversFit } from './leftovers.ts';
import { stillOnlyPlanned, withoutSource, type PlanEntry } from './plan.ts';
import type { MealSlot } from './recipe.ts';

export type MoveRefusal =
  | 'nothing-there' // no meal in the slot to move
  | 'already-happened' // this meal has an outcome, or came off the pantry
  | 'same-day'
  | 'past-day'
  | 'other-happened' // what's on the other day has an outcome, or came off the pantry
  | 'trade-into-past'; // this meal is on a past day, and a trade would put the other one there

export type MoveFrom = { date: ISODate; slot: MealSlot };

const at = (entries: readonly PlanEntry[], date: ISODate, slot: MealSlot) => entries.find(e => e.date === date && e.slot === slot) ?? null;

/** A row with only a recorded nothing in it isn't a meal to move. */
const isMeal = (entry: PlanEntry) => entry.kind !== 'note' || entry.note !== null || entry.drafted !== null;

/** Whether this meal could go to some other day. Which days is `moveRefusal`'s to say. */
export const isMovable = (entry: PlanEntry) => isMeal(entry) && stillOnlyPlanned(entry);

export function moveRefusal(entries: readonly PlanEntry[], from: MoveFrom, to: ISODate, today: ISODate): MoveRefusal | null {
  const meal = at(entries, from.date, from.slot);
  if (!meal || !isMeal(meal)) return 'nothing-there';
  if (!stillOnlyPlanned(meal)) return 'already-happened';
  if (to === from.date) return 'same-day';
  if (to < today) return 'past-day';
  const other = at(entries, to, from.slot);
  if (other && !stillOnlyPlanned(other)) return 'other-happened';
  if (other && from.date < today) return 'trade-into-past';
  return null;
}

export type MealMove = {
  /** What gets written, in its new place. */
  placed: PlanEntry[];
  /** Planned leftovers that no longer work, in the place they were. */
  off: PlanEntry[];
  /** The meal it trades with, unless that was its own leftovers coming off. */
  traded: PlanEntry | null;
};

type Place = { date: ISODate; slot: string };

/**
 * Both meals move whole and are pinned. Leftovers of either follow it when they still come after it, in
 * time. When they don't: ones a person chose or already ate stay and lose their source, and the rest
 * come off. Assumes `moveRefusal` said yes, and that `entries` run from the earlier day on.
 */
export function mealMove(entries: readonly PlanEntry[], from: MoveFrom, to: ISODate): MealMove {
  const meal = at(entries, from.date, from.slot)!;
  const other = at(entries, to, from.slot);
  const isFrom = (p: Place) => p.date === from.date && p.slot === from.slot;
  const isTo = (p: Place) => p.date === to && p.slot === from.slot;
  const newDate = (p: Place) => (isFrom(p) ? to : isTo(p) ? from.date : p.date);

  const placed: PlanEntry[] = [];
  const off: PlanEntry[] = [];
  for (const entry of entries) {
    const moved = entry === meal || entry === other;
    const source = entry.leftoversOf;
    if (!moved && !(source && (isFrom(source) || isTo(source)))) continue;
    const next: PlanEntry = moved ? { ...entry, date: newDate(entry), pinned: true } : entry;
    if (!source) {
      placed.push(next);
      continue;
    }
    const newSource = { ...source, date: newDate(source) };
    if (leftoversFit(next, newSource)) placed.push({ ...next, leftoversOf: newSource });
    else if (entry.outcome || entry.pinned || entry === meal || (entry === other && !isFrom(source))) placed.push(withoutSource(next));
    else off.push(entry);
  }
  return { placed, off, traded: other && !off.includes(other) ? other : null };
}
