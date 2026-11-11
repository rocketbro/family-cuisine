// Asking about earlier days at the next check-in. "Yes" is `confirmPlannedMeals`, like any other day.
// "No" is kept here: it opens that day's rows, and whatever isn't marked stays unrecorded, so nothing comes off for it.
import { CARRY_OVER_DAYS } from '../../domain/checkin.ts';
import { daysToCatchUp } from '../../domain/checkin-catch-up.ts';
import { catchUpCutoff } from '../../domain/tidy-fix-records.ts';
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
  const kept = daysSaidNo(deps).filter(d => d !== day && d >= catchUpCutoff(today));
  deps.household.saveSetting(SAID_NO, JSON.stringify([...kept, day]));
}

export function catchUpNoDays(deps: Deps): ISODate[] {
  return daysSaidNo(deps);
}

/** Answers for days past reach can't matter any more. */
export function forgetOldCatchUp(deps: Deps, today: ISODate): void {
  const kept = daysSaidNo(deps).filter(d => d >= catchUpCutoff(today));
  deps.household.saveSetting(SAID_NO, kept.length ? JSON.stringify(kept) : null);
}
