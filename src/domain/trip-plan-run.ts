// The plan is made the morning of a grocery run, when the next stretch is on your mind. It follows the
// trip wherever it moves. A machine that was off that morning runs it when it's next up, once, under the trip's own key.
import { tripWindow, type ShopSchedule } from './shop-schedule.ts';
import type { ISODate } from './dates.ts';

/** After this long, "the meals are planned" is no help getting ready for the store, so it stays quiet. */
const NOTICE_WINDOW_MINUTES = 4 * 60;

/** The trip whose plan is due, or null. On a trip day, before its time, it just waits for that run. Times are minutes into the day. */
export function tripPlanDue(today: ISODate, minutes: number, schedule: ShopSchedule, planMinutes: number): ISODate | null {
  const { start } = tripWindow(today, schedule);
  return start === today && minutes < planMinutes ? null : start;
}

export function tripNoticeFits(trip: ISODate, today: ISODate, minutes: number, planMinutes: number): boolean {
  return trip === today && minutes < planMinutes + NOTICE_WINDOW_MINUTES;
}

/** How long before the evening check-in the receipt prompt goes out, so the two don't land together. */
const RECEIPT_LEAD_MINUTES = 60;

/** The evening of a trip: add the receipt, or say you didn't go. */
export function receiptPromptDue(today: ISODate, minutes: number, schedule: ShopSchedule, checkinMinutes: number): boolean {
  return tripWindow(today, schedule).start === today && minutes >= checkinMinutes - RECEIPT_LEAD_MINUTES && minutes < checkinMinutes;
}
