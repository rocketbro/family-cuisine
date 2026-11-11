// The days on offer for a meal in this slot, and the plan around them to say what's on each.
import { addDays, type ISODate } from '../../domain/dates.ts';
import { LEFTOVERS_LAST_DAYS } from '../../domain/leftovers.ts';
import { moveDays } from '../../domain/meal-move-days.ts';
import type { MealSlot } from '../../domain/recipe.ts';
import { api } from '../api.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { useToday } from '../hooks/useToday.ts';

export function useMoveDays(date: ISODate, slot: MealSlot) {
  const today = useToday();
  const { data, error, reload } = useLoad(`move:${date}:${slot}:${today}`, async () => {
    const days = moveDays(date, today, (await api.status()).shopping);
    const from = date < today ? date : today;
    const to = addDays(days.at(-1) ?? date, LEFTOVERS_LAST_DAYS);
    return { days, entries: await api.plan(from, to) };
  });
  return { days: data?.days ?? null, entries: data?.entries ?? [], error, reload, today };
}
