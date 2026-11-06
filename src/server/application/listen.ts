// Everything said into the dictation bar comes through here, already in words: let the model work
// out what it means for the pantry and the plan, and hand that back for a quick look.
import { addDays, realDateOrNull, type ISODate } from '../../domain/dates.ts';
import { matchUses, usesText } from '../../domain/drafted-meal.ts';
import { findPantryItem } from '../../domain/pantry.ts';
import { portionsText } from '../../domain/portions.ts';
import { parseUnit } from '../../domain/units.ts';
import { isExtraSlot } from '../../domain/plan-slot.ts';
import { cookedSlug, settledByCheckin, type MealUpdate } from '../../domain/plan.ts';
import { scaleIngredient } from '../../domain/scaling.ts';
import { applySubstitutions } from '../../domain/substitutes.ts';
import type { ListenContext, Proposal, ProposedChange, ProposedMeal } from '../../shared/api-types.ts';
import { recordMeal } from './checkin.ts';
import { settleCookedMeal } from './cooking.ts';
import type { Deps } from './deps.ts';
import { applyPantryChanges } from './pantry.ts';
import type { InterpretRequest, Interpretation, SaidChange } from './ports/ai.ts';
import { UserError } from './user-error.ts';

/** How far back someone can report meals ("on Sunday we had…"). */
const LOOKBACK_DAYS = 6;
const ALREADY_SETTLED = 'The check-in already took this meal off the pantry, so there’s nothing more to change here. If something else is different, say so from the Pantry screen.';

/** Works out what was said (already transcribed; see recordings.ts) or typed. */
export async function listen(deps: Deps, input: { text: string; context: ListenContext; today: ISODate }): Promise<Proposal> {
  if (!deps.ai.available()) throw new UserError('Dictation needs the Anthropic API key in .env.', 503);
  const heard = input.text.trim();
  if (!heard && input.context.kind !== 'cooked') throw new UserError('We didn’t catch anything. Try again a little closer to the phone.');

  // Anything the model worked out from here would come off a second time.
  if (input.context.kind === 'cooked' && settledByCheckin(deps.plan.get(input.context.date, input.context.slot), input.context.slug)) {
    return { heard, summary: ALREADY_SETTLED, pantry: [], meals: [], questions: [] };
  }

  const request = interpretRequest(deps, input.context, input.today, heard);
  const interpretation = await deps.ai.interpret(request);
  return { heard, ...checked(deps, interpretation, request, input.context) };
}

export function applyProposal(deps: Deps, proposal: { pantry: ProposedChange[]; meals: MealUpdate[]; context: ListenContext }): void {
  const { context } = proposal;
  deps.unitOfWork.run(() => {
    // A review opened before the check-in and saved after it: its amounts come from a pantry that has moved on.
    const stale = context.kind === 'cooked' && settledByCheckin(deps.plan.get(context.date, context.slot), context.slug);
    if (stale) deps.log(`left out a late cook review of ${context.slug}: the check-in already settled it`);
    else applyPantryChanges(deps, proposal.pantry);
    for (const meal of proposal.meals) recordMeal(deps, meal);
    if (context.kind === 'checkin') deps.household.markCheckin(context.date, 'meals');
    // Only pantry changes settle a cooked meal; without any, the check-in still takes it off.
    if (context.kind === 'cooked' && proposal.pantry.length && !stale) settleCookedMeal(deps, context.date, context.slot);
  });
}

function interpretRequest(deps: Deps, context: ListenContext, today: ISODate, said: string): InterpretRequest {
  const recipes = deps.recipes.list();
  const titles = new Map(recipes.map(r => [r.slug, r.title]));
  const focus = context.kind === 'checkin' || context.kind === 'cooked' ? context.date : today;
  const meals = deps.plan.range(addDays(focus, -LOOKBACK_DAYS), focus).map(e => ({
    date: e.date, slot: e.slot, outcome: e.outcome,
    planned: e.kind === 'leftovers' ? 'leftovers' : titles.get(e.recipeSlug ?? '') ?? e.note ?? 'nothing planned',
    expectedUses: e.drafted?.uses.length ? usesText(e.drafted.uses) : null,
  }));
  const cookedRecipe = context.kind === 'cooked' ? deps.recipes.get(context.slug) : null;
  return {
    today,
    situation: situation(context, cookedRecipe?.title ?? null),
    said,
    pantry: deps.pantry.list().map(p => ({
      name: p.name, status: p.status, count: p.count, category: p.category, occasional: p.occasional, useBy: p.useBy,
      lastsDays: p.lastsDays, portions: p.portions, alsoCalled: p.alsoCalled,
    })),
    recipes: recipes.map(r => ({ slug: r.slug, title: r.title })),
    meals,
    answering: context.kind === 'pantry' ? context.answering ?? [] : [],
    cooked: cookedRecipe && context.kind === 'cooked'
      ? {
          title: cookedRecipe.title,
          multiplier: context.factor,
          ingredients: applySubstitutions(cookedRecipe.ingredients, context.substituted ?? {}).map(i => {
            const s = scaleIngredient(i, context.factor);
            const swapped = s.note?.startsWith('instead of') ? ` (${s.note})` : '';
            return [s.amountText, s.item].filter(Boolean).join(' ') + swapped + (s.optional ? ' (optional)' : '');
          }),
        }
      : null,
  };
}

function situation(context: ListenContext, cookedTitle: string | null): string {
  switch (context.kind) {
    case 'pantry': return context.answering?.length
      ? `They're answering the questions you asked after their pantry walk-through: ${context.answering.join(' ')} Ask nothing more unless something is still unclear.`
      : 'They started on the pantry screen, walking through the kitchen saying what they have. It may be a long first inventory of the whole kitchen.';
    case 'checkin': return `They are telling you what the family ate on ${context.date}, and maybe what ran out.`;
    case 'cooked': return `They just finished cooking ${cookedTitle ?? 'a recipe'} at ${context.factor}× ${isExtraSlot(context.slot) ? 'as something extra' : `for ${context.slot}`} on ${context.date}. What they said is what they did differently.`;
    default: return 'They started talking from somewhere in the app. It could be about the pantry, meals, or both.';
  }
}

/** An amount in a measure the app doesn't know ("2 bags") counts as "some". */
function cleanPortions(portions: SaidChange['portions']): ProposedChange['portions'] {
  if (!portions?.length) return null;
  return portions.map(p => {
    const unit = p.unit ? parseUnit(p.unit) : p.storage === 'canned' ? 'can' : null;
    return { storage: p.storage, amount: p.unit && !unit ? null : p.amount, unit, canOz: unit === 'can' && p.canOz && p.canOz > 0 ? p.canOz : undefined, useBy: realDateOrNull(p.useBy) };
  });
}

/** Keeps only changes that point at real things, and labels them for the review sheet. */
function checked(
  deps: Deps, result: Interpretation, request: InterpretRequest, context: ListenContext,
): Pick<Proposal, 'summary' | 'pantry' | 'meals' | 'questions'> {
  const pantry = deps.pantry.list();
  const changes: ProposedChange[] = result.pantry.map(change => {
    const match = deps.pantry.findByName(change.name) ?? (change.isNew ? null : findPantryItem(change.name, pantry));
    const current = match ? (match.portions.length ? portionsText(match.portions) : match.count !== null ? `${match.count} on hand` : match.status) : null;
    // Going out clears a date, so there's nothing to show or set for those.
    const inHouse = change.status !== 'out';
    const useBy = inHouse ? realDateOrNull(change.useBy) : null;
    const lastsDays = inHouse && change.lastsDays && change.lastsDays > 0 ? Math.round(change.lastsDays) : null;
    return { ...change, name: match?.name ?? change.name, isNew: !match, pantryItemId: match?.id ?? null, current, useBy, lastsDays, portions: inHouse ? cleanPortions(change.portions) : null,
      // "Two bags" of something isn't a reason to start counting it; only items already counted are.
      count: match?.count != null ? change.count : null };
  });

  const dates = new Set(request.meals.map(m => m.date));
  const recipes = new Map(deps.recipes.list().map(r => [r.slug, r]));
  const meals: ProposedMeal[] = [];
  for (const meal of result.meals) {
    if (!dates.has(meal.date)) continue;
    const entry = deps.plan.get(meal.date, meal.slot);
    if (entry?.pantrySettled) continue;
    // Only an extra in the records is real; the model can't start one by naming a slot.
    if (!entry && isExtraSlot(meal.slot)) continue;
    // The meal just cooked is already recorded, at the size it was made.
    if (context.kind === 'cooked' && meal.date === context.date && meal.slot === context.slot) continue;
    const recipe = meal.recipeSlug ? recipes.get(meal.recipeSlug) ?? null : null;
    const planned = entry ? (entry.kind === 'leftovers' ? 'Leftovers' : recipes.get(cookedSlug({ ...entry, outcome: null }) ?? '')?.title ?? entry.note) : null;
    const title = meal.outcome === 'made' ? planned ?? 'As planned' : meal.outcome === 'skipped' ? 'Skipped' : recipe?.title ?? meal.note ?? 'Something else';
    const uses = entry?.drafted && meal.outcome === 'made' && meal.uses ? matchUses(meal.uses, pantry) : null;
    meals.push({ ...meal, recipeSlug: recipe?.slug ?? null, title, planned, uses });
  }
  return { summary: result.summary, pantry: changes, meals, questions: result.questions.slice(0, 3) };
}
