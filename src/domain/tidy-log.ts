// What each tidy-up did, kept briefly so Settings can say. A run that retries adds to its own entry.
import { addDays, shortDate, type ISODate } from './dates.ts';

export const KEEP_LOG_DAYS = 30;

export type TidyRun = {
  /** The period it ran for (`tidyPeriod`). */
  key: ISODate;
  on: ISODate;
  /** In plain words, what the code fixed. */
  fixed: string[];
  /** Questions put on Today. */
  asked: number;
  /** False when there was no key, so only the fixes ran. */
  askedClaude: boolean;
};

export function withRun(log: readonly TidyRun[], run: TidyRun, today: ISODate): TidyRun[] {
  const earlier = log.find(r => r.key === run.key);
  const merged: TidyRun = earlier
    ? { ...run, fixed: [...earlier.fixed, ...run.fixed], asked: earlier.asked + run.asked, askedClaude: earlier.askedClaude || run.askedClaude }
    : run;
  return [merged, ...log.filter(r => r.key !== run.key && r.on > addDays(today, -KEEP_LOG_DAYS))];
}

const things = (n: number) => `${n} ${n === 1 ? 'thing' : 'things'}`;

/** "Nov 8: fixed 2 things, asked 1 question", or what ran and found nothing. */
export function tidySummary(run: TidyRun | null): string {
  if (!run) return 'Hasn’t run yet';
  const fixed = run.fixed.length ? `fixed ${things(run.fixed.length)}` : 'nothing to fix';
  const asked = run.asked ? `, asked ${run.asked} ${run.asked === 1 ? 'question' : 'questions'}` : '';
  return `${shortDate(run.on)}: ${fixed}${asked}`;
}
