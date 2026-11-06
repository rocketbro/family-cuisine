// Where a meal sits in a day. Breakfast, lunch and dinner hold one meal each and belong to the
// planner too. Extras are anything else someone means to make that day (a birthday cake): a day has
// any number of them, each its own slot, and only a person ever adds one.
import { MEAL_SLOTS, type MealSlot } from './recipe.ts';

export type ExtraSlot = `extra-${number}`;
export type PlanSlot = MealSlot | ExtraSlot;

export function isExtraSlot(slot: string): slot is ExtraSlot {
  return /^extra-[1-9]\d{0,14}$/.test(slot);
}

export function isPlanSlot(slot: string): slot is PlanSlot {
  return isExtraSlot(slot) || MEAL_SLOTS.includes(slot as MealSlot);
}

export const extraSlot = (id: number): ExtraSlot => `extra-${id}`;
export const extraId = (slot: ExtraSlot): number => Number(slot.slice('extra-'.length));

/** "Dinner", "Extra": for labels on screen. */
export function slotLabel(slot: PlanSlot): string {
  return isExtraSlot(slot) ? 'Extra' : slot[0].toUpperCase() + slot.slice(1);
}

/** "dinner", "extra": for use in a sentence. */
export const slotWord = (slot: PlanSlot): string => slotLabel(slot).toLowerCase();

/** The day's three meals, without its extras. */
export const mealsOnly = <T extends { slot: PlanSlot }>(entries: readonly T[]): T[] => entries.filter(e => !isExtraSlot(e.slot));
export const extrasOnly = <T extends { slot: PlanSlot }>(entries: readonly T[]): T[] => entries.filter(e => isExtraSlot(e.slot));
