// Carrying out the fixes the code is sure of, each through the same use case a person's change would use.
import type { ISODate } from '../../domain/dates.ts';
import { withoutSource } from '../../domain/plan.ts';
import { tidyFixes } from '../../domain/tidy-fixes.ts';
import type { FixStep, TidyInputs } from '../../domain/tidy-types.ts';
import { forgetOldCatchUp } from './checkin-catch-up.ts';
import type { Deps } from './deps.ts';
import { forgetOldAnswers } from './dinner-left.ts';
import { forgetOldFridgeLines } from './fridge.ts';
import { forgetOldMealsOff } from './meals-off.ts';
import { updatePantryItem } from './pantry.ts';

function carryOut(deps: Deps, step: FixStep, today: ISODate): void {
  switch (step.step) {
    case 'remove_entry':
      deps.plan.remove(step.date, step.slot);
      return;
    case 'unlink_entry': {
      const entry = deps.plan.get(step.date, step.slot);
      if (entry) deps.plan.upsert(withoutSource(entry));
      return;
    }
    case 'restate':
      // Writing the state again is what applies the rules: a count sets the status, being out clears the date and the temporary names.
      updatePantryItem(deps, step.itemId, step.count !== null ? { count: step.count } : { status: step.status });
      return;
    case 'set_other_names':
      updatePantryItem(deps, step.itemId, { alsoCalled: step.alsoCalled });
      return;
    case 'forget_old_meals_off':
      forgetOldMealsOff(deps, today);
      return;
    case 'forget_old_catch_up':
      forgetOldCatchUp(deps, today);
      return;
    case 'forget_old_answers':
      forgetOldAnswers(deps, today);
      return;
    case 'forget_old_fridge':
      forgetOldFridgeLines(deps, today);
      return;
  }
}

/** Applies each fix, one at a time, so one that can't be done doesn't stop the rest. Returns the log lines of those done. */
export function applyFixes(deps: Deps, inputs: TidyInputs): string[] {
  const done: string[] = [];
  for (const fix of tidyFixes(inputs)) {
    try {
      deps.unitOfWork.run(() => carryOut(deps, fix.step, inputs.today));
      done.push(fix.line);
    } catch (error) {
      deps.log(`tidy-up: couldn't ${fix.check}: ${(error as Error).message}`);
    }
  }
  return done;
}

