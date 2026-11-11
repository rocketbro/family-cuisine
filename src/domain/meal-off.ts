// A planned meal the app took off by itself, remembered so people hear about it and can have it back.
import type { Availability } from './availability.ts';
import { weekdayName, type ISODate } from './dates.ts';
import { cookedSlug, type PlanEntry } from './plan.ts';
import { slotLabel } from './plan-slot.ts';
import type { MealSlot } from './recipe.ts';

export type MealOff = {
  date: ISODate;
  slot: MealSlot;
  title: string;
  recipeSlug: string;
  multiplier: number;
  /** "no tortillas", when the code knows. */
  why: string | null;
  told: boolean;
};

type Notice = { title: string; body: string; url: string };

/** Never earlier than this, whatever the plan time, because the nightly run takes meals off around 3 AM. */
const EARLIEST_MINUTES = 6 * 60;
/** Past this it's no morning notice any more. The Day screen still says so. */
const WINDOW_MINUTES = 4 * 60;

export function mealsOffNoticeDue(minutes: number, planMinutes: number): boolean {
  const start = Math.max(planMinutes, EARLIEST_MINUTES);
  return minutes >= start && minutes < start + WINDOW_MINUTES;
}

export function whyItCameOff({ missing, short }: Pick<Availability, 'missing' | 'short'>, inSeason: boolean): string | null {
  if (missing.length) return `no ${missing.slice(0, 2).join(' or ')}`;
  if (short.length) return `not enough ${short.slice(0, 2).join(' or ')}`;
  return inSeason ? null : 'out of season';
}

/** Still worth saying: the day hasn't gone, nobody has chosen something else or recorded the meal, and it isn't back on. */
export function stillOff(off: MealOff, current: PlanEntry | null, today: ISODate): boolean {
  if (off.date < today) return false;
  return !current || (!current.pinned && !current.outcome && cookedSlug(current) !== off.recipeSlug);
}

function possessiveDay(date: ISODate, today: ISODate): string {
  return `${date === today ? 'Today' : weekdayName(date)}’s`;
}

/** "Lunch changed to soup — no tortillas for tacos". The replacement is whatever is in the slot now, if anything. */
export function mealOffLine(off: Pick<MealOff, 'slot' | 'title' | 'why'>, replacement: string | null): string {
  const reason = off.why ? `${off.why} for ${off.title}` : `${off.title} came off`;
  return `${slotLabel(off.slot)} changed${replacement ? ` to ${replacement}` : ''} — ${reason}`;
}

export function mealsOffNotice(offs: readonly MealOff[], today: ISODate): Notice {
  const [first] = offs;
  const url = `/day/${first.date}`;
  if (offs.length === 1) {
    return { title: `${possessiveDay(first.date, today)} ${first.title} came off`, body: `${first.why ? `${capitalized(first.why)}. ` : ''}Tap to put it back.`, url };
  }
  const lines = offs.map(off => `${possessiveDay(off.date, today)} ${off.title}${off.why ? `: ${off.why}` : ''}.`);
  return { title: `${offs.length} meals came off`, body: lines.join(' '), url };
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** What's kept after more came off: a slot's latest is the one that counts, and a day gone is forgotten. */
export function remembered(kept: readonly MealOff[], fresh: readonly MealOff[], today: ISODate): MealOff[] {
  const replaced = (off: MealOff) => fresh.some(f => f.date === off.date && f.slot === off.slot);
  return [...kept.filter(off => off.date >= today && !replaced(off)), ...fresh];
}
