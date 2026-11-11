// Everything the tidy-up fixes without asking.
import { danglingMeals, strandedLeftovers } from './tidy-fix-plan.ts';
import { countsOutOfStep, leftoverOnOutItems, untidyOtherNames } from './tidy-fix-pantry.ts';
import { expiredRecords } from './tidy-fix-records.ts';
import type { Fix, TidyInputs } from './tidy-types.ts';

export function tidyFixes(inputs: TidyInputs): Fix[] {
  return [
    ...danglingMeals(inputs),
    ...strandedLeftovers(inputs),
    ...untidyOtherNames(inputs.pantry),
    ...leftoverOnOutItems(inputs),
    ...countsOutOfStep(inputs.pantry),
    ...expiredRecords(inputs),
  ];
}
