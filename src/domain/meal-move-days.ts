// The short list of days a meal can go to: the rest of its trip, and always a few days past the meal,
// since "have it tomorrow" shouldn't vanish on the trip's last day. A past day is never on it.
import { addDays, dateRange, type ISODate } from './dates.ts';
import { tripWindow, type ShopSchedule } from './shop-schedule.ts';

const ALWAYS_AHEAD_DAYS = 3;

export function moveDays(date: ISODate, today: ISODate, schedule: ShopSchedule): ISODate[] {
  const window = tripWindow(date, schedule);
  const from = window.start > today ? window.start : today;
  const soonest = addDays(date > today ? date : today, ALWAYS_AHEAD_DAYS);
  return dateRange(from, window.end > soonest ? window.end : soonest).filter(day => day !== date);
}
