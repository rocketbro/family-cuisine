// Fills open slots on the plan. The model plans when it is available; the rotation planner fills
// whatever is left, so a day is never empty. Until the next shopping trip, only meals the pantry
// already covers go on the plan: today's meals are always ready to cook.
import { addDays, dateRange, toISODate, type ISODate } from '../../domain/dates.ts';
import { entryKey, type PlanEntry } from '../../domain/plan.ts';
import { plannedToCommit } from '../../domain/plan-commit.ts';
import { MEAL_SLOTS } from '../../domain/recipe.ts';
import { rotationPlan } from '../../domain/rotation-planner.ts';
import { cookableCheck } from './cookable-check.ts';
import type { Deps } from './deps.ts';
import { householdProfile } from './household-profile.ts';
import { newDishes, validPlan } from './model-plan.ts';
import { nightBeforeCheck } from './night-before-check.ts';
import { pantryForPlanning } from './pantry-for-planning.ts';
import { plannerContext } from './planner-context.ts';

/** Only `planning.ts` calls this, which keeps it to one run at a time. */
export async function fillPlan(deps: Deps, from: ISODate, through: ISODate): Promise<number> {
  const recipes = deps.recipes.list();
  if (!recipes.length && !deps.ai.available()) return 0;
  const history = deps.plan.range(addDays(from, -deps.settings.historyDays), addDays(from, -1));
  const existing = deps.plan.range(from, through);
  const taken = new Set(existing.map(entryKey));
  const dates = dateRange(from, through).filter(date => MEAL_SLOTS.some(slot => !taken.has(entryKey({ date, slot }))));
  if (!dates.length) return 0;

  let proposed: PlanEntry[] = [];
  if (deps.ai.available()) {
    try {
      const meals = await deps.ai.planMeals(plannerContext(deps, recipes, dates, history, existing));
      const chosen = validPlan(deps, meals, recipes, new Set(dates), taken);
      proposed = [...chosen, ...await newDishes(deps, meals, new Set(dates), new Set([...taken, ...chosen.map(entryKey)]))];
    } catch (error) {
      deps.log(`model planning failed, using the rotation: ${(error as Error).message}`);
    }
  }
  // The model took a while. From here to the last write nothing waits and everything is read
  // fresh, so meals pinned or checked off and pantry changes made in the meantime all count.
  const current = deps.plan.range(from, through);
  // Until the groceries come, every meal draws on the same pantry, so each one counts against the next.
  const running = pantryForPlanning(deps, toISODate(new Date()));
  const cookableNow = cookableCheck(deps, running.ready);
  // Only what's being chosen now: a meal already on the plan stays, however late its step is, because someone may have done it.
  const inTime = nightBeforeCheck(deps);
  const canCook: typeof cookableNow = (recipe, date, multiplier) => inTime(recipe, date) && cookableNow(recipe, date, multiplier);
  const stillOpen = new Set(current.map(entryKey));
  const cookable = [...proposed].sort((a, b) => a.date.localeCompare(b.date)).filter(e => {
    if (!e.recipeSlug) return true;
    if (!canCook({ slug: e.recipeSlug }, e.date, e.multiplier)) return false;
    // One that's lost its slot stays in for `plannedToCommit` to see, but takes nothing.
    if (!stillOpen.has(entryKey(e))) running.take(e.recipeSlug, e.date, e.multiplier);
    return true;
  });
  const planned = plannedToCommit(cookable, current, history);
  // Claude's picks come back only when Claude brings them back or the family keeps them.
  const gaps = rotationPlan({
    dates, recipes: recipes.filter(r => !r.claudesPick), existing: [...history, ...current, ...planned], canCook,
    portions: householdProfile(deps).portions,
    onChoose: (recipe, date, multiplier) => running.take(recipe.slug, date, multiplier),
  });
  return [...planned, ...gaps].filter(entry => deps.plan.fillIfOpen(entry)).length;
}
