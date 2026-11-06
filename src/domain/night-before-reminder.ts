// The evening reminder: which of tomorrow's meals have a step to do tonight, what the notification
// says, and when it's still worth sending.
import type { ISODate } from './dates.ts';
import type { PlanSlot } from './plan-slot.ts';
import type { PlanEntry } from './plan.ts';
import type { Recipe } from './recipe.ts';

/** A service that comes back this long after the set time still sends it. Later, it stays quiet: the app's line says it instead. */
export const REMINDER_WINDOW_MINUTES = 180;

/** Times are minutes into the day. A window running past midnight just ends at midnight, because the next day has its own. */
export function reminderWindowOpen(minutes: number, reminderMinutes: number): boolean {
  return minutes >= reminderMinutes && minutes < reminderMinutes + REMINDER_WINDOW_MINUTES;
}

export type NightBeforeTask = { slug: string; title: string; step: string; date: ISODate; slot: PlanSlot; multiplier: number };

type Entry = Pick<PlanEntry, 'date' | 'slot' | 'kind' | 'recipeSlug' | 'multiplier' | 'outcome'>;
type RecipeStep = Pick<Recipe, 'title' | 'nightBefore'>;

/** What the entries (meals and extras alike) ask of tonight. Only meals still to be made, and each recipe once. */
export function nightBeforeTasks(entries: readonly Entry[], recipeFor: (slug: string) => RecipeStep | null | undefined): NightBeforeTask[] {
  const tasks = new Map<string, NightBeforeTask>();
  for (const entry of entries) {
    if (entry.kind !== 'recipe' || entry.outcome !== null || !entry.recipeSlug || tasks.has(entry.recipeSlug)) continue;
    const recipe = recipeFor(entry.recipeSlug);
    if (!recipe?.nightBefore) continue;
    tasks.set(entry.recipeSlug, { slug: entry.recipeSlug, title: recipe.title, step: recipe.nightBefore, date: entry.date, slot: entry.slot, multiplier: entry.multiplier });
  }
  return [...tasks.values()];
}

const startingLower = (step: string) => (/^[A-Z][a-z]/.test(step) ? step[0].toLowerCase() + step.slice(1) : step);

/** One notification, however many there are. Null when there's nothing to do tonight. */
export function nightBeforeNotice(tasks: readonly NightBeforeTask[]): { title: string; body: string; url: string } | null {
  const [first] = tasks;
  if (!first) return null;
  if (tasks.length === 1) {
    const params = new URLSearchParams({ x: String(first.multiplier), date: first.date, slot: first.slot });
    return { title: `Tomorrow: ${first.title}`, body: `${first.step}.`, url: `/recipes/${first.slug}?${params}` };
  }
  return {
    title: 'Tonight, for tomorrow’s meals',
    body: tasks.map(task => `${task.title}: ${startingLower(task.step)}.`).join(' '),
    url: `/day/${first.date}`,
  };
}
