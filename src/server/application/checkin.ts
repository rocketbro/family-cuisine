// The evening check-in: what did you actually eat, and what did it use up?
import { CARRY_OVER_DAYS, carriedMeals, checkinQuestions, mealsToSettle } from '../../domain/checkin.ts';
import { addDays, dateRange, toISODate, type ISODate } from '../../domain/dates.ts';
import { isExtraSlot } from '../../domain/plan-slot.ts';
import { blankEntry, cookedSlug, type PlanEntry } from '../../domain/plan.ts';
import { asksAnyLeft } from '../../domain/dinner-left.ts';
import { catchUpDays } from './checkin-catch-up.ts';
import { settleMeals } from './checkin-settle.ts';
import { dinnersLeft } from './dinner-left.ts';
import { batchFor } from './household-profile.ts';
import { leftoversFollow } from './leftovers-follow.ts';
import { sizeWithoutSwap } from './planned-size.ts';
import type { Deps } from './deps.ts';
import { planView } from './plan-view.ts';
import type { MealUpdate } from '../../domain/plan.ts';
import type { CheckinView, PantryReport } from '../../shared/api-types.ts';

export function checkinView(deps: Deps, date: ISODate): CheckinView {
  const state = deps.household.checkin(date);
  const meals = planView(deps, date, date);
  const step = !state.mealsDone ? 'meals' : !state.pantryDone ? 'pantry' : 'done';
  const earlier = step === 'meals' ? catchUpDays(deps, date, toISODate(new Date())) : [];
  if (step !== 'pantry') return { date, step, meals, questions: { counts: [], needs: [], uses: [] }, carried: [], earlier, anyLeft: null };
  const recipes = new Map(deps.recipes.list().map(r => [r.slug, r]));
  const entries = reachOfCheckin(deps, date);
  return { date, step, meals, questions: checkinQuestions(entries, date, recipes, deps.pantry.list()), carried: carriedMeals(entries, date, recipes), earlier, anyLeft: asksAnyLeft(meals) ? { answer: dinnersLeft(deps)[date] ?? null } : null };
}

function reachOfCheckin(deps: Deps, date: ISODate): PlanEntry[] {
  return deps.plan.range(addDays(date, -CARRY_OVER_DAYS), date);
}

/** "We ate what was planned" for every meal of the day. */
export function confirmPlannedMeals(deps: Deps, date: ISODate): void {
  deps.unitOfWork.run(() => {
    for (const entry of deps.plan.range(date, date)) {
      if (!entry.outcome) recordMeal(deps, { date, slot: entry.slot, outcome: 'made', recipeSlug: null, note: null });
    }
    deps.household.markCheckin(date, 'meals');
  });
}

export function recordMeal(deps: Deps, update: MealUpdate): void {
  const found = deps.plan.get(update.date, update.slot);
  if (!found && isExtraSlot(update.slot)) return; // taken off the plan since, and saying its number doesn't make one
  const entry = found ?? blankEntry(update.date, update.slot);
  if (entry.pantrySettled) return; // cook mode's changes are saved, at the size it was made
  const swappedTo = update.outcome === 'swapped' && update.recipeSlug ? deps.recipes.get(update.recipeSlug) : null;
  const sameAsPlanned = swappedTo !== null && entry.kind === 'recipe' && entry.recipeSlug === swappedTo.slug;
  const alreadyRecorded = swappedTo !== null && entry.outcome === 'swapped' && entry.outcomeSlug === swappedTo.slug;
  const next: PlanEntry = {
    ...entry,
    outcome: sameAsPlanned ? 'made' : update.outcome,
    outcomeSlug: sameAsPlanned ? null : swappedTo?.slug ?? null,
    // Something not in the book ("red beans and rice") is kept as a note, so planning knows it was eaten.
    note: update.outcome === 'swapped' && !swappedTo && update.note ? update.note : entry.note,
    // What was cooked instead was cooked at its own size, not the planned dish's. Cook mode knows that size already.
    multiplier: swappedTo && !sameAsPlanned && !alreadyRecorded ? batchFor(deps, swappedTo.serves) : update.outcome === 'made' || sameAsPlanned ? sizeWithoutSwap(deps, entry) : entry.multiplier,
    drafted: entry.drafted && update.uses ? { ...entry.drafted, uses: update.uses } : entry.drafted,
  };
  // Swaps belong to the dish they were chosen for.
  const saved = cookedSlug(next) === cookedSlug(entry) ? next : { ...next, substituted: null };
  deps.unitOfWork.run(() => {
    deps.plan.upsert(saved);
    leftoversFollow(deps, found, saved);
  });
}

/** Days answered but not settled were just settled by this one, so they have no pantry step left to ask. */
function finishEarlierDays(deps: Deps, date: ISODate): void {
  for (const day of dateRange(addDays(date, -CARRY_OVER_DAYS), addDays(date, -1))) {
    const { mealsDone, pantryDone } = deps.household.checkin(day);
    if (mealsDone && !pantryDone) deps.household.markCheckin(day, 'pantry');
  }
}

/**
 * Settles the day's pantry in one go, with any earlier meals still left to settle. Once it's done, the same
 * report again (a lost response, a second phone) changes nothing, and no later check-in or cook review takes these meals off again.
 */
export function recordPantry(deps: Deps, date: ISODate, report: PantryReport): void {
  deps.unitOfWork.run(() => {
    if (deps.household.checkin(date).pantryDone) return;
    settleMeals(deps, date, mealsToSettle(reachOfCheckin(deps, date), date), report);
    deps.household.markCheckin(date, 'pantry');
    finishEarlierDays(deps, date);
  });
}
