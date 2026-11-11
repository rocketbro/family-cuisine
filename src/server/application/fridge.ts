// "In the fridge" (domain/fridge.ts), kept as one JSON value in household_settings.fridge. It is
// never part of the pantry, the list or what a recipe can be made from. Lines past their days are
// dropped whenever the list is read or written, so nothing needs a job.
import { randomUUID } from 'node:crypto';
import type { ISODate } from '../../domain/dates.ts';
import {
  cleanFridgeText, FRIDGE_TEXT_MAX, fridgeForModel, inTheFridge, withFridgeLine, withoutDinnerLine, withoutEatenLeftovers, withoutFridgeLine,
  type FridgeForModel, type FridgeLine,
} from '../../domain/fridge.ts';
import type { PlanEntry } from '../../domain/plan.ts';
import type { Deps } from './deps.ts';
import { UserError } from './user-error.ts';

type Store = Pick<Deps, 'household'>;
const KEY = 'fridge';

function stored(deps: Store): FridgeLine[] {
  try {
    const raw: unknown = JSON.parse(deps.household.setting(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter(l => l && typeof l.id === 'string' && typeof l.text === 'string' && typeof l.since === 'string') : [];
  } catch {
    return [];
  }
}

const save = (deps: Store, lines: readonly FridgeLine[]) => deps.household.saveSetting(KEY, JSON.stringify(lines));

export const fridgeLines = (deps: Store, today: ISODate): FridgeLine[] => inTheFridge(stored(deps), today);

/** What Claude is told, for the planner and the dice. */
export const fridgeForClaude = (deps: Store, today: ISODate): FridgeForModel[] => fridgeForModel(stored(deps), today);

export function addFridgeLine(deps: Store, text: string, today: ISODate, dinner: ISODate | null = null): void {
  const clean = cleanFridgeText(text);
  if (!clean) throw new UserError(`Say what’s in the fridge, in up to ${FRIDGE_TEXT_MAX} letters.`, 400);
  save(deps, withFridgeLine(stored(deps), { id: randomUUID(), text: clean, since: dinner ?? today, dinner }, today));
}

export function usedUpFridgeLine(deps: Store, id: string): void {
  save(deps, withoutFridgeLine(stored(deps), id));
}

/** Answering "Any dinner left?": a yes puts the dish in the fridge, dated that day, and a no takes it out. */
export function dinnerLeftInFridge(deps: Store, date: ISODate, dish: string | null, left: boolean, today: ISODate): void {
  if (!left) return save(deps, withoutDinnerLine(stored(deps), date));
  if (dish) addFridgeLine(deps, dish, today, date);
}

/** Eating a dinner as its planned leftovers uses its line up. Call it in the transaction that records the meal. */
export function fridgeFollowsMeal(deps: Store, entry: PlanEntry): void {
  const lines = stored(deps);
  const rest = withoutEatenLeftovers(lines, entry);
  if (rest.length !== lines.length) save(deps, rest);
}

/** Since dates of every line kept, including ones past their days that nothing has written over yet. */
export function fridgeSinceDates(deps: Store): ISODate[] {
  return stored(deps).map(line => line.since);
}

/** Lines past their days are dropped whenever the list is written; this does the same when nobody has written it. */
export function forgetOldFridgeLines(deps: Store, today: ISODate): void {
  const kept = inTheFridge(stored(deps), today);
  deps.household.saveSetting(KEY, kept.length ? JSON.stringify(kept) : null);
}
