// What the model is told when it plans.
import { toISODate, type ISODate } from '../../domain/dates.ts';
import { isExtraSlot } from '../../domain/plan-slot.ts';
import { cookedSlug, type PlanEntry } from '../../domain/plan.ts';
import { useSoonText } from '../../domain/portions.ts';
import { plannableMeals, type Recipe } from '../../domain/recipe.ts';
import { seasonOf } from '../../domain/seasons.ts';
import { beforeGroceries } from '../../domain/shop-schedule.ts';
import { goingOffSoon } from '../../domain/use-by.ts';
import type { Deps } from './deps.ts';
import { fridgeForClaude } from './fridge.ts';
import { batchFor } from './household-profile.ts';
import { nightBeforeTooLate } from './night-before-check.ts';
import { pantryCountingLastTrip } from './pantry-with-trip.ts';
import type { PlannerContext } from './ports/ai.ts';
import { recipeCard } from './recipe-views.ts';
import { shopSchedule } from './shop-schedule.ts';

/** The planner looks a week out, further than the pantry's "Use soon" group. */
const PLANNER_USE_SOON_DAYS = 7;

export function plannerContext(
  deps: Deps, recipes: Recipe[], dates: ISODate[], history: PlanEntry[], existing: PlanEntry[],
): PlannerContext {
  const today = toISODate(new Date());
  const pantry = pantryCountingLastTrip(deps, today);
  const titles = new Map(recipes.map(r => [r.slug, r.title]));
  const describe = (e: PlanEntry) => ({ date: e.date, slot: isExtraSlot(e.slot) ? 'extra' as const : e.slot, title: e.kind === 'leftovers' ? 'leftovers' : titles.get(cookedSlug(e) ?? '') ?? e.note ?? '' });
  return {
    dates,
    seasonOfDate: Object.fromEntries(dates.map(d => [d, seasonOf(d)])),
    readyOnlyDates: dates.filter(d => beforeGroceries(d, today, shopSchedule(deps))),
    tooLateForNightBefore: nightBeforeTooLate(deps, dates),
    recipes: recipes.filter(r => plannableMeals(r.meals).length).map(r => ({
      slug: r.slug, title: r.title, meals: plannableMeals(r.meals), kind: r.kind, batch: r.batch, serves: r.serves, tags: r.tags, seasons: r.seasons,
      availability: recipeCard(r, pantry, batchFor(deps, r.serves)).availability.level, claudesPick: r.claudesPick, nightBefore: r.nightBefore !== null,
    })),
    inHouse: pantry.filter(p => p.status !== 'out' && p.category !== 'Other').map(p => p.name),
    avoid: deps.avoided.list().map(({ title, reason }) => ({ title, reason })),
    history: history.map(describe),
    alreadyPlanned: existing.map(describe),
    lowOrOut: pantry.filter(p => !p.staple && !p.occasional && p.status !== 'have').map(p => `${p.name} (${p.status})`),
    useSoon: goingOffSoon(pantry, today, PLANNER_USE_SOON_DAYS).filter(p => p.useBy! >= today).map(useSoonText),
    fridge: fridgeForClaude(deps, today),
  };
}
