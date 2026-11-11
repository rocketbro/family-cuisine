// Records kept in household settings past how long they are documented to last: meals_off until its day has gone,
// checkin_catch_up_no for twice CARRY_OVER_DAYS, dinners_left for KEEP_ANSWERS_DAYS, and fridge lines for FRIDGE_DAYS.
// Writing them again drops the old ones; nothing reads an old one, so it only stops them piling up.
import { CARRY_OVER_DAYS } from './checkin.ts';
import { addDays } from './dates.ts';
import { KEEP_ANSWERS_DAYS } from './dinner-left.ts';
import { FRIDGE_DAYS } from './fridge.ts';
import type { Fix, FixStep, TidyInputs } from './tidy-types.ts';

export function catchUpCutoff(today: string): string {
  return addDays(today, -CARRY_OVER_DAYS * 2);
}

function forgetting(count: number, check: string, step: FixStep, line: (n: number) => string): Fix[] {
  return count ? [{ check, line: line(count), step }] : [];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Kept = Pick<TidyInputs, 'today' | 'mealsOffDates' | 'catchUpNoDays' | 'dinnerAnswerDays' | 'fridgeSince'>;

export function expiredRecords({ today, mealsOffDates, catchUpNoDays, dinnerAnswerDays, fridgeSince }: Kept): Fix[] {
  return [
    ...forgetting(mealsOffDates.filter(d => d < today).length, 'old-meals-off', { step: 'forget_old_meals_off' },
      n => `Forgot ${plural(n, 'note', 'notes')} about meals that came off on days gone by`),
    ...forgetting(catchUpNoDays.filter(d => d < catchUpCutoff(today)).length, 'old-catch-up', { step: 'forget_old_catch_up' },
      n => `Forgot ${plural(n, 'old “not as planned” answer', 'old “not as planned” answers')}`),
    ...forgetting(dinnerAnswerDays.filter(d => d < addDays(today, -KEEP_ANSWERS_DAYS)).length, 'old-any-left', { step: 'forget_old_answers' },
      n => `Forgot ${plural(n, 'old answer', 'old answers')} to “Any left?”`),
    ...forgetting(fridgeSince.filter(d => d <= addDays(today, -FRIDGE_DAYS)).length, 'old-fridge', { step: 'forget_old_fridge' },
      n => `Cleared ${plural(n, 'line', 'lines')} from the fridge list that had been there past ${FRIDGE_DAYS} days`),
  ];
}
