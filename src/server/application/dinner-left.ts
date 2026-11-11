// The answers to "Any left?", which feed the swap sheet and the dice. Saying none also takes planned
// leftovers of that dinner off, since they aren't in the fridge to eat.
import { addDays, type ISODate } from '../../domain/dates.ts';
import { asksAnyLeft, type DinnerLeft } from '../../domain/dinner-left.ts';
import { dishName, leftoversOfChange, LEFTOVERS_LAST_DAYS } from '../../domain/leftovers.ts';
import type { Deps } from './deps.ts';
import { UserError } from './user-error.ts';

const ANSWERS = 'dinners_left';
const FOREVER = '9999-12-31';
const KEEP_ANSWERS_DAYS = 14;

export function dinnersLeft(deps: Deps): Record<ISODate, DinnerLeft> {
  return JSON.parse(deps.household.setting(ANSWERS) ?? '{}');
}

export function sayAnyLeft(deps: Deps, date: ISODate, answer: DinnerLeft, today: ISODate): void {
  const dinner = deps.plan.get(date, 'dinner');
  if (!dinner || !asksAnyLeft([dinner])) throw new UserError('That dinner hasn’t been marked as eaten.', 409);
  const kept = Object.entries(dinnersLeft(deps)).filter(([day]) => day >= addDays(today, -KEEP_ANSWERS_DAYS));
  deps.unitOfWork.run(() => {
    deps.household.saveSetting(ANSWERS, JSON.stringify({ ...Object.fromEntries(kept), [date]: answer }));
    if (answer === 'some') return;
    const { off, plain } = leftoversOfChange(deps.plan.range(date, FOREVER), dinner);
    for (const entry of off) deps.plan.remove(entry.date, entry.slot);
    for (const entry of plain) deps.plan.upsert(entry);
  });
}

/** What someone said is really in the fridge, for a meal on this date. */
export function leftoversInTheFridge(deps: Deps, date: ISODate, titleOf: (slug: string) => string | null): { date: ISODate; title: string }[] {
  const said = dinnersLeft(deps);
  return deps.plan.range(addDays(date, -LEFTOVERS_LAST_DAYS), date).flatMap(entry => {
    const title = entry.slot === 'dinner' && entry.date < date && said[entry.date] === 'some' ? dishName(entry, titleOf) : null;
    return title ? [{ date: entry.date, title }] : [];
  });
}
