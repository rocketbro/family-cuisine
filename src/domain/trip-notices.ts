// What the phone says on the day of a trip.
import { addDays, weekdayDate, type ISODate } from './dates.ts';
import { tripWindow, type ShopSchedule } from './shop-schedule.ts';

type Notice = { title: string; body: string; url: string };

/** The morning of: when the next trip is, which decides how long this one has to last. */
export function tripMorningNotice(today: ISODate, schedule: ShopSchedule, planned: boolean): Notice {
  const { end } = tripWindow(today, schedule);
  const next = weekdayDate(addDays(end, 1));
  return planned
    ? { title: 'Meals are planned for this trip', body: `Through ${weekdayDate(end)}. Next trip: ${next}. Tap to change it.`, url: '/week' }
    : { title: 'Shopping today', body: `Next trip: ${next}. Tap to change it or plan this trip’s meals.`, url: '/week' };
}

export function tripReceiptNotice(today: ISODate): Notice {
  return { title: 'Did you go shopping today?', body: 'Add the receipt, or tell us you’re going another day.', url: `/shop/trip/${today}` };
}
