import type { ISODate } from '../../../domain/dates.ts';
import type { ExtraSlot, PlanSlot } from '../../../domain/plan-slot.ts';
import type { PlanEntry } from '../../../domain/plan.ts';

export type PlanRepository = {
  /** Every meal and extra in those days: by date, the day's meals first, then its extras in the order they were added. */
  range(from: ISODate, to: ISODate): PlanEntry[];
  get(date: ISODate, slot: PlanSlot): PlanEntry | null;
  upsert(entry: PlanEntry): void;
  /** Adds a meal only if its slot is still empty; false when something's there, and always false for an extra: the planner doesn't get to fill those. */
  fillIfOpen(entry: PlanEntry): boolean;
  remove(date: ISODate, slot: PlanSlot): void;
  /** Adds an extra to its day, in a new slot that's never been used before. */
  addExtra(entry: Omit<PlanEntry, 'slot'>): ExtraSlot;
};
