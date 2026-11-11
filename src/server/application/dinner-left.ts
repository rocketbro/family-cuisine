// The answers to "Any left?", which decide what the swap sheet offers and put the dish in the fridge (fridge.ts). Saying none also takes planned
// leftovers of that dinner off, since they aren't in the fridge to eat.
import { addDays, type ISODate } from '../../domain/dates.ts';
import { asksAnyLeft, KEEP_ANSWERS_DAYS, type DinnerLeft } from '../../domain/dinner-left.ts';
import { dishName, leftoversOfChange } from '../../domain/leftovers.ts';
import type { Deps } from './deps.ts';
import { dinnerLeftInFridge } from './fridge.ts';
import { UserError } from './user-error.ts';

const ANSWERS = 'dinners_left';
const FOREVER = '9999-12-31';

export function dinnersLeft(deps: Deps): Record<ISODate, DinnerLeft> {
  return JSON.parse(deps.household.setting(ANSWERS) ?? '{}');
}

export function sayAnyLeft(deps: Deps, date: ISODate, answer: DinnerLeft, today: ISODate): void {
  const dinner = deps.plan.get(date, 'dinner');
  if (!dinner || !asksAnyLeft([dinner])) throw new UserError('That dinner hasn’t been marked as eaten.', 409);
  const kept = Object.entries(dinnersLeft(deps)).filter(([day]) => day >= addDays(today, -KEEP_ANSWERS_DAYS));
  deps.unitOfWork.run(() => {
    deps.household.saveSetting(ANSWERS, JSON.stringify({ ...Object.fromEntries(kept), [date]: answer }));
    // One fridge: a yes puts the dish on the same list as anything typed there, a no takes it off.
    dinnerLeftInFridge(deps, date, dishName(dinner, slug => deps.recipes.get(slug)?.title ?? null), answer === 'some', today);
    if (answer === 'some') return;
    const { off, plain } = leftoversOfChange(deps.plan.range(date, FOREVER), dinner);
    for (const entry of off) deps.plan.remove(entry.date, entry.slot);
    for (const entry of plain) deps.plan.upsert(entry);
  });
}

/** The days answered, whether or not they are still worth keeping. */
export function dinnerAnswerDays(deps: Deps): ISODate[] {
  return Object.keys(dinnersLeft(deps));
}

/** Answers older than the days they matter for are only there because nothing was answered since. */
export function forgetOldAnswers(deps: Deps, today: ISODate): void {
  const kept = Object.entries(dinnersLeft(deps)).filter(([day]) => day >= addDays(today, -KEEP_ANSWERS_DAYS));
  deps.household.saveSetting(ANSWERS, kept.length ? JSON.stringify(Object.fromEntries(kept)) : null);
}
