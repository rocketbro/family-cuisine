// Test setup: records a meal as cooked, the way cooking it used to.
import type { ISODate } from '../../../domain/dates.ts';
import { blankEntry, cookedEntry, cookedSlug, slotForHour } from '../../../domain/plan.ts';
import type { PlanSlot } from '../../../domain/plan-slot.ts';
import type { Substitutions } from '../../../domain/substitutes.ts';
import type { CookedMeal } from '../../../shared/api-types.ts';
import type { Deps } from '../deps.ts';
import { leftoversFollow } from '../leftovers-follow.ts';

export function finishCooking(deps: Deps, input: {
  slug: string; factor: number; today: ISODate; hour: number; date?: ISODate; slot?: PlanSlot;
  substituted?: Substitutions;
}): CookedMeal {
  const date = input.date ?? input.today;
  // Opened from a planned meal, that's the one; otherwise today's meal or extra with this recipe, or the meal of the hour.
  const slot = input.slot
    ?? deps.plan.range(date, date).find(e => !e.outcome && cookedSlug(e) === input.slug)?.slot
    ?? slotForHour(input.hour);
  const planned = deps.plan.get(date, slot) ?? blankEntry(date, slot);
  const cooked = cookedEntry(planned, input.slug, input.factor, input.substituted ?? null);
  deps.unitOfWork.run(() => {
    deps.plan.upsert(cooked);
    leftoversFollow(deps, planned, cooked);
  });
  return { date, slot };
}
