// A scheduled job's run: claimed while it works, finished only once the work succeeded.

/** `leaseUntil` null while unfinished means it's never retried on its own (a notification may have gone out). */
export type JobRun = { completedAt: string | null; leaseUntil: string | null };

/** Times are ISO timestamps. */
export function jobClaimable(run: JobRun | null, now: string): boolean {
  if (!run) return true;
  if (run.completedAt) return false;
  return run.leaseUntil !== null && run.leaseUntil <= now;
}

export type ClockTime = { hour: number; minute: number };

/** "17:00" as a time of day, or null when it isn't one. */
export function parseClock(text: string | null): ClockTime | null {
  const match = text?.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

export const clockValue = ({ hour, minute }: ClockTime): string => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

export const minutesOf = ({ hour, minute }: ClockTime): number => hour * 60 + minute;

/** When the scheduled jobs run. */
export type JobSchedule = { planTime: { hour: number; minute: number }; checkinTime: { hour: number; minute: number } };
