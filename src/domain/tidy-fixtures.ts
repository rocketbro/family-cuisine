// Inputs for the tidy-up's tests. Only test files import this.
import type { TidyInputs } from './tidy-types.ts';

export const TODAY = '2026-11-12';

export const tidyInputs = (extra: Partial<TidyInputs> = {}): TidyInputs => ({
  today: TODAY, pantry: [], recipes: [], recipesTrustworthy: true, plan: [], standInsForNow: [], trips: [], mealsOffDates: [], catchUpNoDays: [], dinnerAnswerDays: [], fridgeSince: [], ...extra,
});
