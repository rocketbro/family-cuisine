// Leftovers follow what actually happened: only a meal that was made has any, and when a meal turns
// out to be something else, leftovers of the old dish aren't there to eat.
import { addDays, type ISODate } from './dates.ts';
import { leftoversOfRemoved, withoutSource, type PlanEntry } from './plan.ts';
import { MEAL_SLOTS, type MealSlot } from './recipe.ts';

/** How long after a meal its leftovers are still worth offering, or keeping on the plan when the meal moves. */
export const LEFTOVERS_LAST_DAYS = 3;

type TitleOf = (slug: string) => string | null;

/** What this meal is, or was, in words. A note left behind by an earlier answer doesn't count once it's a recipe again. */
export function dishName(entry: PlanEntry, titleOf: TitleOf): string | null {
  if (entry.outcome === 'skipped') return null;
  if (entry.outcome === 'swapped') return entry.outcomeSlug ? titleOf(entry.outcomeSlug) : entry.note;
  if (entry.kind === 'recipe') return entry.recipeSlug ? titleOf(entry.recipeSlug) : null;
  return entry.kind === 'note' ? entry.note : null;
}

/** The dish, once someone has said it was made. A meal that's only planned has nothing left over yet. */
export function madeName(entry: PlanEntry, titleOf: TitleOf): string | null {
  return entry.outcome ? dishName(entry, titleOf) : null;
}

export function sameDish(a: PlanEntry, b: PlanEntry): boolean {
  const asIs: TitleOf = slug => slug;
  return dishName(a, asIs) === dishName(b, asIs);
}

export type LeftoversOfChange = {
  /** The app planned them, so they come off. */
  off: PlanEntry[];
  /** A person chose them, so they stay, as plain leftovers. */
  plain: PlanEntry[];
};

/** What happens to leftovers still to be eaten when this meal stops being the dish they were of. */
export function leftoversOfChange(entries: readonly PlanEntry[], meal: PlanEntry): LeftoversOfChange {
  const leftovers = leftoversOfRemoved(entries, [meal]);
  return { off: leftovers.filter(e => !e.pinned), plain: leftovers.filter(e => e.pinned).map(withoutSource) };
}

type Place = { date: ISODate; slot: PlanEntry['slot'] };

const slotOrder = (slot: PlanEntry['slot']) => MEAL_SLOTS.indexOf(slot as MealSlot);

/** Leftovers have to come after their meal, and soon enough after it to still be good. */
export function leftoversFit(eaten: Place, source: Place): boolean {
  const afterIt = source.date < eaten.date || (source.date === eaten.date && slotOrder(source.slot) < slotOrder(eaten.slot));
  return afterIt && eaten.date <= addDays(source.date, LEFTOVERS_LAST_DAYS);
}
