// Asking about earlier days at the next check-in. "Yes" is `confirmPlannedMeals`, like any other day.
// "No" is kept here: it opens that day's rows, and whatever isn't marked stays unrecorded, so nothing comes off for it.
import { CARRY_OVER_DAYS } from '../../domain/checkin.ts';
import { daysToCatchUp } from '../../domain/checkin-catch-up.ts';
import { addDays, type ISODate } from '../../domain/dates.ts';
import type { CheckinView } from '../../shared/api-types.ts';
import type { Deps } from './deps.ts';
import { planView } from './plan-view.ts';

const SAID_NO = 'checkin_catch_up_no';

function daysSaidNo(deps: Deps): ISODate[] {
  return JSON.parse(deps.household.setting(SAID_NO) ?? '[]');
}

export function catchUpDays(deps: Deps, date: ISODate, today: ISODate): CheckinView['earlier'] {
  const no = daysSaidNo(deps);
  const days = daysToCatchUp(deps.plan.range(addDays(date, -CARRY_OVER_DAYS), date), {
    date, today, began: deps.household.firstCheckin(),
    answered: day => no.includes(day) || deps.household.checkin(day).mealsDone,
  });
  return days.map(day => ({ date: day, meals: planView(deps, day, day) }));
}

/** Only days still in reach need remembering. */
export function sayNotAsPlanned(deps: Deps, day: ISODate, today: ISODate): void {
  const kept = daysSaidNo(deps).filter(d => d !== day && d >= addDays(today, -CARRY_OVER_DAYS * 2));
  deps.household.saveSetting(SAID_NO, JSON.stringify([...kept, day]));
}
