// What the app may plan by itself. Clearing the plan holds both until someone plans again, or a
// wiped plan would quietly fill back up overnight.
export type AutomaticPlanning = {
  /** The morning of each grocery run: the trip's meals. */
  tripMorning: boolean;
  /** Overnight: today and tomorrow have meals. */
  nightly: boolean;
  /** The plan was cleared and nobody has planned since. */
  held: boolean;
};

export const DEFAULT_AUTOMATIC_PLANNING: AutomaticPlanning = { tripMorning: true, nightly: true, held: false };

export function readAutomaticPlanning(saved: string | null): AutomaticPlanning {
  try {
    const value: unknown = JSON.parse(saved ?? 'null');
    if (typeof value !== 'object' || value === null) return DEFAULT_AUTOMATIC_PLANNING;
    const { tripMorning, nightly, held } = value as Record<string, unknown>;
    return { tripMorning: tripMorning !== false, nightly: nightly !== false, held: held === true };
  } catch {
    return DEFAULT_AUTOMATIC_PLANNING;
  }
}

export const tripMorningRuns = (a: AutomaticPlanning): boolean => a.tripMorning && !a.held;
export const nightlyRuns = (a: AutomaticPlanning): boolean => a.nightly && !a.held;
export const plansOnItsOwn = (a: AutomaticPlanning): boolean => tripMorningRuns(a) || nightlyRuns(a);
