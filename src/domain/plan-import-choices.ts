// The decisions a review of an imported plan needs: which of two meals in a slot, and which day.
import type { ISODate } from './dates.ts';
import type { ImportedMeal, ImportSlot } from './plan-import.ts';

/** A meal in a review. `key` tells two lines with the same words apart. */
export type ReviewedMeal = { key: number; date: ISODate | null; slot: ImportSlot };

/** What's stopping a save, first thing first. */
export type SaveBlocker =
  | { kind: 'clash'; date: ISODate; slot: ImportSlot }
  | { kind: 'no-day'; count: number }
  | { kind: 'nothing' };

const inSameSlot = (a: ReviewedMeal, b: ReviewedMeal) => a.slot !== 'extra' && a.date !== null && a.date === b.date && a.slot === b.slot;

/** Meals that share a slot, grouped; each group has two or more. Extras can pile up, so they never do. */
export function clashGroups<T extends ReviewedMeal>(meals: readonly T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const meal of meals) {
    if (meal.slot === 'extra' || !meal.date) continue;
    const key = `${meal.date}:${meal.slot}`;
    groups.set(key, [...(groups.get(key) ?? []), meal]);
  }
  return [...groups.values()].filter(group => group.length > 1);
}

/** "Use this": this meal stays, and the other imported meals in its slot go. */
export function chooseMeal<T extends ReviewedMeal>(meals: readonly T[], key: number): T[] {
  const chosen = meals.find(meal => meal.key === key);
  return chosen ? meals.filter(meal => meal.key === key || !inSameSlot(meal, chosen)) : [...meals];
}

/** "Remove", and "Keep" what's already planned: either way this imported meal goes. */
export function withoutMeal<T extends ReviewedMeal>(meals: readonly T[], key: number): T[] {
  return meals.filter(meal => meal.key !== key);
}

/**
 * Whether the review can be saved. `saving` is what would be saved, so slots on days gone by or with a
 * meal already made aren't anyone's decision. A meal with no day has to get one or be removed.
 */
export function saveBlocker(saving: readonly ReviewedMeal[], all: readonly ReviewedMeal[]): SaveBlocker | null {
  const [clash] = clashGroups(saving);
  if (clash) return { kind: 'clash', date: clash[0].date!, slot: clash[0].slot };
  const count = all.filter(meal => meal.date === null).length;
  if (count) return { kind: 'no-day', count };
  return saving.length ? null : { kind: 'nothing' };
}

/** The first day a change touched, to show it. Null when nothing moved or nothing changed on a real day. */
export function firstChangedDate(before: readonly ImportedMeal[], after: readonly ImportedMeal[]): ISODate | null {
  const same = (a: ImportedMeal, b: ImportedMeal) => a.date === b.date && a.slot === b.slot && JSON.stringify(a.match) === JSON.stringify(b.match);
  const changed = [
    ...before.filter(a => !after.some(b => same(a, b))),
    ...after.filter(b => !before.some(a => same(a, b))),
  ].flatMap(meal => meal.date ?? []);
  return changed.sort()[0] ?? null;
}
