// A change of plan: this meal goes to another day, same slot, trading places with what's there.
import type { ISODate } from '../../domain/dates.ts';
import { mealMove, moveRefusal, type MoveFrom, type MoveRefusal } from '../../domain/meal-move.ts';
import type { Deps } from './deps.ts';
import { UserError } from './user-error.ts';

const FOREVER = '9999-12-31';

const REFUSALS: Record<MoveRefusal, string> = {
  'nothing-there': 'Nothing is planned for that meal.',
  'already-happened': 'That meal has already been recorded, so it stays on its day.',
  'same-day': 'It’s already on that day.',
  'past-day': 'That day has gone by.',
  'other-happened': 'The meal on that day has already been recorded, so it can’t trade places.',
  'trade-into-past': 'That day has a meal, and it can’t go back to a day gone by. Pick an open day.',
};

/** All of it or none of it. */
export function moveMeal(deps: Deps, from: MoveFrom, to: ISODate, today: ISODate): void {
  deps.unitOfWork.run(() => {
    const entries = deps.plan.range(from.date < to ? from.date : to, FOREVER);
    const refused = moveRefusal(entries, from, to, today);
    if (refused) throw new UserError(REFUSALS[refused], refused === 'nothing-there' ? 404 : 409);
    const { placed, off, traded } = mealMove(entries, from, to);
    for (const entry of off) deps.plan.remove(entry.date, entry.slot);
    if (!traded) deps.plan.remove(from.date, from.slot);
    for (const entry of placed) deps.plan.upsert(entry);
  });
}
