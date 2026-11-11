// The meals taken off a day, each with what stands in its slot now, for the Day screen's note.
import type { ISODate } from '../../domain/dates.ts';
import { dishName } from '../../domain/leftovers.ts';
import type { MealOffView } from '../../shared/views.ts';
import type { Deps } from './deps.ts';
import { mealsOffOn } from './meals-off.ts';

export function mealsOffView(deps: Deps, date: ISODate, today: ISODate): MealOffView[] {
  return mealsOffOn(deps, date, today).map(off => {
    const now = deps.plan.get(off.date, off.slot);
    const titleOf = (slug: string) => deps.recipes.get(slug)?.title ?? null;
    const replacement = now?.kind === 'leftovers' ? 'leftovers' : now ? dishName(now, titleOf) : null;
    return { ...off, replacement };
  });
}
