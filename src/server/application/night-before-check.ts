// Keeps what's choosing a meal on its own (the planner, the dice) off a recipe whose night-before step
// nobody would get to in time. A meal already on the plan is never held to this, and neither is a person.
import { toISODate, type ISODate } from '../../domain/dates.ts';
import { minutesOf } from '../../domain/job-run.ts';
import { nightBeforeInTime } from '../../domain/night-before.ts';
import type { Deps } from './deps.ts';
import { nightBeforeTime } from './night-before-time.ts';

function inTime(deps: Deps): (date: ISODate) => boolean {
  const now = new Date();
  const today = toISODate(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const reminder = minutesOf(nightBeforeTime(deps));
  return date => nightBeforeInTime(date, today, minutes, reminder);
}

export function nightBeforeCheck(deps: Deps): (recipe: { slug: string }, date: ISODate) => boolean {
  const onTime = inTime(deps);
  return (recipe, date) => !deps.recipes.get(recipe.slug)?.nightBefore || onTime(date);
}

export function nightBeforeTooLate(deps: Deps, dates: readonly ISODate[]): ISODate[] {
  const onTime = inTime(deps);
  return dates.filter(date => !onTime(date));
}
