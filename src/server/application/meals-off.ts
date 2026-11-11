// Meals the app took off by itself, kept in household settings until their day has gone, so a
// morning notice and the Day screen can say so. Putting one back pins it.
import type { ISODate } from '../../domain/dates.ts';
import { remembered, stillOff, type MealOff } from '../../domain/meal-off.ts';
import type { MealSlot } from '../../domain/recipe.ts';
import type { Deps } from './deps.ts';
import { placeChoice } from './set-meal.ts';
import { UserError } from './user-error.ts';

const KEY = 'meals_off';

function stored(deps: Deps): MealOff[] {
  return JSON.parse(deps.household.setting(KEY) ?? '[]');
}

function save(deps: Deps, offs: readonly MealOff[]): void {
  deps.household.saveSetting(KEY, offs.length ? JSON.stringify(offs) : null);
}

/** Earliest first, so a notice's link goes to the first one. */
function standing(deps: Deps, today: ISODate): MealOff[] {
  return stored(deps)
    .filter(off => stillOff(off, deps.plan.get(off.date, off.slot), today))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function rememberMealsOff(deps: Deps, today: ISODate, offs: readonly MealOff[]): void {
  if (offs.length) save(deps, remembered(stored(deps), offs, today));
}

export function mealsOffOn(deps: Deps, date: ISODate, today: ISODate): MealOff[] {
  return standing(deps, today).filter(off => off.date === date);
}

export function untoldMealsOff(deps: Deps, today: ISODate): MealOff[] {
  return standing(deps, today).filter(off => !off.told);
}

export function markMealsOffTold(deps: Deps, told: readonly MealOff[]): void {
  const said = (off: MealOff) => told.some(t => t.date === off.date && t.slot === off.slot);
  save(deps, stored(deps).map(off => (said(off) ? { ...off, told: true } : off)));
}

/** Someone cleared the plan, so these aren't waiting to go back. */
export function forgetMealsOff(deps: Deps): void {
  save(deps, []);
}

/** Puts the meal back at its size, pinned, so nothing replaces it again. Its leftovers stay gone: their slots may hold something else by now. */
export function putMealBack(deps: Deps, date: ISODate, slot: MealSlot, today: ISODate): void {
  deps.unitOfWork.run(() => {
    const off = mealsOffOn(deps, date, today).find(o => o.slot === slot);
    if (!off) throw new UserError('That meal can’t go back any more.', 409);
    placeChoice(deps, date, slot, { kind: 'recipe', recipeSlug: off.recipeSlug, multiplier: off.multiplier });
    save(deps, stored(deps).filter(o => o.date !== date || o.slot !== slot));
  });
}

/** Someone has read it and wants it gone. The meal stays as it is. */
export function dismissMealOff(deps: Deps, date: ISODate, slot: MealSlot): void {
  save(deps, stored(deps).filter(o => o.date !== date || o.slot !== slot));
}

/** The days of the notes kept, whether or not they still stand. */
export function mealsOffDates(deps: Deps): ISODate[] {
  return stored(deps).map(off => off.date);
}

/** Notes for days that have gone are only there because nothing came off since. */
export function forgetOldMealsOff(deps: Deps, today: ISODate): void {
  save(deps, remembered(stored(deps), [], today));
}
