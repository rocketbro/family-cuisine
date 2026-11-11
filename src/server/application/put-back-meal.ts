// "Tacos came off. Move them to another day?" The meal goes on the chosen day. If something's there
// it comes off in turn, and the screen makes the same offer about that one.
import { placedCameOff, type CameOffMeal } from '../../domain/came-off.ts';
import type { ISODate } from '../../domain/dates.ts';
import { stillOnlyPlanned } from '../../domain/plan.ts';
import type { Deps } from './deps.ts';
import { placeMeal } from './place-meal.ts';
import { UserError } from './user-error.ts';

export function putBackMeal(deps: Deps, meal: CameOffMeal, to: ISODate, today: ISODate): CameOffMeal | null {
  if (to < today) throw new UserError('That day has gone by.', 409);
  if (!deps.recipes.get(meal.recipeSlug)) throw new UserError('That recipe no longer exists.', 404);
  return deps.unitOfWork.run(() => {
    const there = deps.plan.get(to, meal.slot);
    if (there && !stillOnlyPlanned(there)) throw new UserError('The meal on that day has already been recorded.', 409);
    return placeMeal(deps, placedCameOff(meal, to));
  });
}
