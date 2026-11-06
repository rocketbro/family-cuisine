// Which week's plan is due now, and whether its notice still makes sense. A machine that was off on
// the plan day runs that week's plan when it's next up, once, under the plan day's own key.
import { addDays, dayOfWeek, type ISODate } from './dates.ts';

/** How many days late a weekly plan still runs. The day after that, the next one is about to. */
export const WEEKLY_CATCH_UP_DAYS = 5;

/** The plan day whose run is due, or null. On the plan day, before its time, it just waits for that run. Times are minutes into the day. */
export function weeklyRunDay(today: ISODate, minutes: number, planWeekday: number, planMinutes: number): ISODate | null {
  const daysLate = (dayOfWeek(today) - planWeekday + 7) % 7;
  if (daysLate === 0) return minutes >= planMinutes ? today : null;
  return daysLate <= WEEKLY_CATCH_UP_DAYS ? addDays(today, -daysLate) : null;
}

/**
 * "This week's meals are planned" belongs to the plan day. A day late it still helps, in the daytime:
 * there's a trip to get ready for, and an old nudge in the middle of the night helps nobody. After that it stays quiet.
 */
export function weeklyNoticeFits(runDay: ISODate, today: ISODate, minutes: number, planMinutes: number, checkinMinutes: number): boolean {
  if (runDay === today) return true;
  return addDays(runDay, 1) === today && minutes >= planMinutes && minutes < checkinMinutes;
}
