// Extras: anything else someone means to make on a day, on top of its meals. Only a person ever
// adds or changes one. Once on the plan they're ordinary plan entries, so the list, cook mode, Done
// and the check-in treat them like any other meal.
import type { ISODate } from '../../domain/dates.ts';
import { extraSlot, type ExtraSlot } from '../../domain/plan-slot.ts';
import { blankEntry, type PlanEntry } from '../../domain/plan.ts';
import type { ExtraChoice } from '../../shared/api-types.ts';
import type { Deps } from './deps.ts';
import { batchFor } from './household-profile.ts';
import { UserError } from './user-error.ts';

/** Any placeholder will do: an entry's slot is filled in when it's stored. */
const UNSAVED = extraSlot(1);

function chosenExtra(deps: Deps, date: ISODate, slot: ExtraSlot, choice: ExtraChoice): PlanEntry {
  const base = { ...blankEntry(date, slot), pinned: true };
  if (choice.kind === 'note') return { ...base, kind: 'note', note: choice.note.trim() || 'Something extra' };
  const recipe = deps.recipes.get(choice.recipeSlug);
  if (!recipe) throw new UserError('That recipe no longer exists.', 404);
  return { ...base, kind: 'recipe', recipeSlug: recipe.slug, multiplier: choice.multiplier ?? batchFor(deps, recipe.serves) };
}

export function addExtra(deps: Deps, date: ISODate, choice: ExtraChoice): ExtraSlot {
  const { slot: _unsaved, ...entry } = chosenExtra(deps, date, UNSAVED, choice);
  return deps.plan.addExtra(entry);
}

/** A named extra can become a real recipe, as long as it hasn't come off the pantry yet. */
export function changeExtra(deps: Deps, date: ISODate, slot: ExtraSlot, choice: ExtraChoice): void {
  if (!unsettled(deps, date, slot)) throw new UserError('That’s no longer on the plan.', 404);
  deps.plan.upsert(chosenExtra(deps, date, slot, choice));
}

export function removeExtra(deps: Deps, date: ISODate, slot: ExtraSlot): void {
  unsettled(deps, date, slot);
  deps.plan.remove(date, slot);
}

/** Taking one off wouldn't put back what it used, so what's come off stays on the record. */
function unsettled(deps: Deps, date: ISODate, slot: ExtraSlot): PlanEntry | null {
  const entry = deps.plan.get(date, slot);
  if (entry?.checkinSettled || entry?.pantrySettled) throw new UserError('That one has already come off the pantry, so it stays on the record.', 409);
  return entry;
}
