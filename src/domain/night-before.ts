// A step that has to happen the evening before a recipe is cooked, like soaking dry beans. It lives
// in the recipe's header, and it reaches a phone's lock screen, so whoever wrote it (a person, or a
// model reading a stranger's page) it's one short line of plain words.
import { addDays, type ISODate } from './dates.ts';

export const NIGHT_BEFORE_LONGEST = 120;

const MARKUP = /[<>[\]{}`*_#|~\\]/;
const LINK = /[a-z][a-z0-9+.-]*:\/\/|\b(?:mailto|data|javascript|tel):|\b[a-z0-9-]+\.[a-z]{2,}\b/i;
const INVISIBLE = /\p{Cc}|\p{Cf}/u;
const NOTHING = /^(?:none|no|nothing|null|n\/?a)$/i;

/** The step as it's kept, or null when there isn't one or it isn't a short line of plain words. */
export function cleanNightBefore(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const step = value.replace(/\s+/g, ' ').trim().replace(/[.!\s]+$/, '');
  if (!step || NOTHING.test(step)) return null;
  if (step.length > NIGHT_BEFORE_LONGEST || MARKUP.test(step) || LINK.test(step) || INVISIBLE.test(step)) return null;
  return step;
}

/** Text someone meant as a step but that can't be kept as one. Empty is fine: it means no step. */
export function nightBeforeRefused(value: string): boolean {
  const said = value.replace(/[.!\s]+$/, '').trim();
  return said !== '' && !NOTHING.test(said) && cleanNightBefore(value) === null;
}

export type NightBeforeDue = 'tonight' | 'last-night';

/** For a meal on `date`: its step is due tonight, was due last night, or is no concern yet (or any more). */
export function nightBeforeDue(date: ISODate, today: ISODate): NightBeforeDue | null {
  if (date === addDays(today, 1)) return 'tonight';
  return date === today ? 'last-night' : null;
}

const DUE_WORDS: Record<NightBeforeDue, string> = { tonight: 'Tonight', 'last-night': 'Needed last night' };

/** "Tonight: Soak the beans overnight", said beside a planned meal. */
export function nightBeforeLine(step: string, due: NightBeforeDue): string {
  return `${DUE_WORDS[due]}: ${step}`;
}

type PlannedMeal = { date: ISODate; kind: string; recipeSlug: string | null; outcome: string | null };

/** Whether a meal's step is due, for the line under it. One made, skipped or swapped has nothing left to prepare for. */
export function dueForMeal(entry: PlannedMeal, today: ISODate): NightBeforeDue | null {
  return entry.kind === 'recipe' && entry.outcome === null ? nightBeforeDue(entry.date, today) : null;
}

/** Whether a recipe's step is due for any meal on the plan. What can still be done wins over what's gone by. */
export function dueForRecipe(entries: readonly PlannedMeal[], slug: string, today: ISODate): NightBeforeDue | null {
  const due = entries.filter(entry => entry.recipeSlug === slug).map(entry => dueForMeal(entry, today));
  return due.includes('tonight') ? 'tonight' : due.includes('last-night') ? 'last-night' : null;
}

/**
 * Whether the planner may still put a recipe with a step on `date`. Today is too late, since last
 * night has gone. Tomorrow is fine until the evening's reminder time: after it nobody gets told, so
 * the planner leaves it. A person choosing it isn't stopped, only told. Times are minutes into the day.
 */
export function nightBeforeInTime(date: ISODate, today: ISODate, minutes: number, reminderMinutes: number): boolean {
  if (date <= today) return false;
  return date !== addDays(today, 1) || minutes < reminderMinutes;
}
