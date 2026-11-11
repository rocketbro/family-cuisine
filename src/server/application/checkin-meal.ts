// Marking one meal at the check-in: Made, Skipped, or something else by name, with no model involved.
import { ateSomethingElse, withMealMark, type MealMark } from '../../domain/checkin-marks.ts';
import type { ISODate } from '../../domain/dates.ts';
import type { PlanSlot } from '../../domain/plan-slot.ts';
import { entryKey, type PlanEntry } from '../../domain/plan.ts';
import type { Deps } from './deps.ts';
import { leftoversFollow } from './leftovers-follow.ts';
import { sizeWithoutSwap } from './planned-size.ts';
import { UserError } from './user-error.ts';

/** A meal planned only as a name keeps that name in the same field a typed one goes in, so it waits here to come back. */
const PLANNED_NOTES = 'checkin_planned_notes';

export function markMeal(deps: Deps, date: ISODate, slot: PlanSlot, mark: MealMark): void {
  deps.unitOfWork.run(() => {
    const entry = deps.plan.get(date, slot);
    if (!entry) throw new UserError('That meal isn’t on the plan any more.', 404);
    // Checking a meal off again after unchecking it is fine: its pantry was already settled, and stays so.
    const rechecked = entry.outcome === null && mark.outcome === 'made';
    if ((entry.pantrySettled || entry.checkinSettled) && !rechecked) throw new UserError('That meal has already come off the pantry, so it stays as it is.', 409);
    const planned = plannedNote(deps, entry);
    keepPlannedNote(deps, entry, mark.outcome === 'other' ? planned : null);
    const next = { ...withMealMark(entry, mark, planned), multiplier: mark.outcome === 'made' ? sizeWithoutSwap(deps, entry) : entry.multiplier };
    deps.plan.upsert(next);
    leftoversFollow(deps, entry, next);
  });
}

function savedNotes(deps: Deps): Record<string, string> {
  return JSON.parse(deps.household.setting(PLANNED_NOTES) ?? '{}');
}

function plannedNote(deps: Deps, entry: PlanEntry): string | null {
  if (!ateSomethingElse(entry)) return entry.note;
  return savedNotes(deps)[entryKey(entry)] ?? (entry.kind === 'note' ? entry.note : null);
}

function keepPlannedNote(deps: Deps, entry: PlanEntry, note: string | null): void {
  const { [entryKey(entry)]: _old, ...rest } = savedNotes(deps);
  const notes = note ? { ...rest, [entryKey(entry)]: note } : rest;
  deps.household.saveSetting(PLANNED_NOTES, Object.keys(notes).length ? JSON.stringify(notes) : null);
}
