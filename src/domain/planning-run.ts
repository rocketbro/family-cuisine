// How requests to plan combine, so there's only ever one planning run going and one waiting.
import type { ISODate } from './dates.ts';

/** Check the plan still holds from today, then fill it through a date (null: only refill what came off). */
export type PlanRequest = {
  today: ISODate;
  through: ISODate | null;
  /** Only recipes in the book: no new dishes, and no Claude's picks nobody kept. */
  bookOnly?: boolean;
};

/** Whether a run already going does everything this request asks. */
export function runCovers(running: PlanRequest, wanted: PlanRequest): boolean {
  if (running.today !== wanted.today) return false;
  // A run that may invent dishes can't stand in for one that promised not to.
  if (wanted.bookOnly && !running.bookOnly) return false;
  return wanted.through === null || (running.through !== null && running.through >= wanted.through);
}

/** One run that does what both ask. If either holds to the book, it does. */
export function mergedRequests(a: PlanRequest, b: PlanRequest): PlanRequest {
  const through = a.through === null || b.through === null ? a.through ?? b.through : later(a.through, b.through);
  return { today: later(a.today, b.today), through, ...(a.bookOnly || b.bookOnly ? { bookOnly: true } : {}) };
}

/** The one range a run fills: what was asked for, stretched over any meals that just came off. */
export function rangeToFill({ today, through }: PlanRequest, removed: readonly ISODate[]): { from: ISODate; through: ISODate } | null {
  const sorted = [...removed].sort();
  if (!sorted.length) return through === null ? null : { from: today, through };
  const last = sorted[sorted.length - 1];
  return through === null ? { from: sorted[0], through: last } : { from: today, through: later(through, last) };
}

function later(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}
