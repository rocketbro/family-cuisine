// A shopping trip nobody recorded: its meals stay, and the planner can choose from its list, until someone records it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blankEntry, type PlanEntry } from '../../domain/plan.ts';
import type { TripLine } from '../../domain/receipts.ts';
import { withTripMoved } from '../../domain/shop-schedule.ts';
import { pantryItem, recipe } from '../../domain/test-fixtures.ts';
import { clearUpcomingPlan } from './clear-plan.ts';
import { fillPlan } from './fill-plan.ts';
import { keepPlanCookable } from './keep-plan-cookable.ts';
import { mealsOffOn, putMealBack } from './meals-off.ts';
import { plannerContext } from './planner-context.ts';
import { pantryForPlanning } from './pantry-for-planning.ts';
import { setMeal } from './set-meal.ts';
import { fakeDeps } from './test-support/full-deps-fake.ts';

// Wednesdays are shopping days.
const TRIP = '2026-11-11';
const THURSDAY = '2026-11-12';
const FRIDAY = '2026-11-13';
const NEXT_TRIP = '2026-11-18';

const line = (name: string, pantryItemId: number | null, over: Partial<TripLine> = {}): TripLine => ({
  key: name, name, pantryItemId, store: 'aldi', reason: 'needed', neededFor: [], checkedOff: false, addedCount: 0, ...over,
});
const tacos = recipe('tacos', ['- 2 tortillas'], { title: 'Tacos' });
const toast = recipe('toast', ['- bread'], { meals: ['breakfast', 'lunch', 'dinner'] });
const meal = (date: string, slug = 'tacos', over: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(date, 'dinner'), kind: 'recipe', recipeSlug: slug, ...over });

function house(list: TripLine[] | null = [line('tortillas', 1)]) {
  const deps = fakeDeps({ ai: false, recipes: [tacos, toast], pantry: [pantryItem(1, 'tortillas', { status: 'out' }), pantryItem(2, 'bread')] });
  if (list) deps.receipts.saveTripList(TRIP, list);
  deps.plan.upsert(meal(FRIDAY));
  return deps;
}
const onPlan = (deps: ReturnType<typeof fakeDeps>, date = FRIDAY) => deps.plan.get(date, 'dinner')?.recipeSlug;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${THURSDAY}T03:00:00`));
});
afterEach(() => void vi.useRealTimers());

describe('keepPlanCookable after a trip nobody recorded', () => {
  it('leaves a meal the trip’s list covers', () => {
    const deps = house();
    expect(keepPlanCookable(deps, THURSDAY)).toEqual([]);
    expect(onPlan(deps)).toBe('tacos');
    expect(deps.pantry.get(1)?.status).toBe('out');
  });
  it('still takes off a meal the list doesn’t cover', () => {
    const deps = house([line('milk', null)]);
    expect(keepPlanCookable(deps, THURSDAY)).toHaveLength(1);
  });
  it('still takes it off with no list on record', () => {
    expect(keepPlanCookable(house(null), THURSDAY)).toHaveLength(1);
  });
  it('believes the pantry once something’s put away for the trip', () => {
    expect(keepPlanCookable(house([line('tortillas', 1), line('milk', null, { checkedOff: true })]), THURSDAY)).toHaveLength(1);
  });
  it('believes the pantry once a receipt is applied to the trip', () => {
    const deps = house();
    deps.receipts.list = () => [{ shopDate: TRIP, status: 'applied' }] as never;
    expect(keepPlanCookable(deps, THURSDAY)).toHaveLength(1);
  });
  it('doesn’t count a list before its trip has happened', () => {
    const deps = house(null);
    deps.receipts.saveTripList(NEXT_TRIP, [line('tortillas', 1)]);
    expect(keepPlanCookable(deps, THURSDAY)).toHaveLength(1);
  });
  it('doesn’t count a trip that was moved to another day, until that day has gone', () => {
    const deps = house();
    const moved = '2026-11-14';
    deps.household.saveShopTrips(withTripMoved([TRIP], TRIP, moved));
    deps.receipts.saveTripList(moved, [line('tortillas', 1)]);
    expect(keepPlanCookable(deps, THURSDAY)).toHaveLength(1);

    vi.setSystemTime(new Date('2026-11-15T03:00:00'));
    deps.plan.upsert(meal('2026-11-16'));
    expect(keepPlanCookable(deps, '2026-11-15')).toEqual([]);
  });
  it('stops counting at the next trip', () => {
    const deps = house();
    vi.setSystemTime(new Date(`${NEXT_TRIP}T03:00:00`));
    deps.plan.upsert(meal(NEXT_TRIP));
    expect(keepPlanCookable(deps, NEXT_TRIP).map(e => e.date)).toEqual([NEXT_TRIP]);
  });
});

describe('what the planner may choose after a trip nobody recorded', () => {
  it('holds days before the next trip to the pantry with the list in it', () => {
    const deps = house();
    expect(pantryForPlanning(deps, THURSDAY).ready(tacos, 1)).toBe(true);
  });
  it('takes the list’s counted items down as meals come off them', () => {
    const deps = house([line('tortillas', 1, { quantity: 3 })]);
    deps.pantry.update(1, { count: 0, status: 'out' });
    deps.plan.remove(FRIDAY, 'dinner');
    const running = pantryForPlanning(deps, THURSDAY);
    expect(running.ready(tacos, 1)).toBe(true);
    running.take('tacos', FRIDAY, 1);
    expect(running.ready(tacos, 1)).toBe(false);
  });
  it('lets the rotation choose from the list', async () => {
    const deps = house();
    deps.plan.remove(FRIDAY, 'dinner');
    deps.recipes.list = () => [tacos];
    await fillPlan(deps, FRIDAY, FRIDAY);
    expect(onPlan(deps)).toBe('tacos');
  });
  it('doesn’t, once the trip is recorded', async () => {
    const deps = house([line('tortillas', 1), line('milk', null, { checkedOff: true })]);
    deps.plan.remove(FRIDAY, 'dinner');
    deps.recipes.list = () => [tacos];
    await fillPlan(deps, FRIDAY, FRIDAY);
    expect(deps.plan.get(FRIDAY, 'dinner')).toBeNull();
  });
  it('tells the model the same', () => {
    const deps = house();
    const context = plannerContext(deps, [tacos], [FRIDAY], [], []);
    expect(context.readyOnlyDates).toEqual([FRIDAY]);
    expect(context.recipes[0].availability).toBe('ready');
    expect(context.inHouse).toContain('tortillas');
    expect(context.lowOrOut).not.toContain('tortillas (out)');
  });
});

describe('a meal taken off by itself', () => {
  const taken = () => {
    const deps = house(null);
    keepPlanCookable(deps, THURSDAY);
    return deps;
  };
  it('is remembered with what it was missing', () => {
    expect(mealsOffOn(taken(), FRIDAY, THURSDAY)).toEqual([expect.objectContaining({ slot: 'dinner', title: 'Tacos', why: 'no tortillas', told: false })]);
  });
  it('isn’t remembered when nothing came off', () => {
    const deps = house();
    keepPlanCookable(deps, THURSDAY);
    expect(mealsOffOn(deps, FRIDAY, THURSDAY)).toEqual([]);
  });
  it('isn’t remembered when a person took it off', async () => {
    const deps = house(null);
    await setMeal(deps, FRIDAY, 'dinner', { kind: 'recipe', recipeSlug: 'toast' });
    expect(keepPlanCookable(deps, THURSDAY)).toEqual([]);
    expect(mealsOffOn(deps, FRIDAY, THURSDAY)).toEqual([]);
  });
  it('stops being said when a person then chooses something else', async () => {
    const deps = taken();
    await setMeal(deps, FRIDAY, 'dinner', { kind: 'recipe', recipeSlug: 'toast' });
    expect(mealsOffOn(deps, FRIDAY, THURSDAY)).toEqual([]);
  });
  it('stops being said when a person clears the plan', () => {
    const deps = taken();
    clearUpcomingPlan(deps, THURSDAY);
    expect(mealsOffOn(deps, FRIDAY, THURSDAY)).toEqual([]);
  });
  it('goes back pinned at its size, over what replaced it, and nothing replaces it again', () => {
    const deps = house(null);
    deps.plan.upsert(meal(FRIDAY, 'tacos', { multiplier: 2 }));
    keepPlanCookable(deps, THURSDAY);
    deps.plan.upsert(meal(FRIDAY, 'toast'));

    putMealBack(deps, FRIDAY, 'dinner', THURSDAY);
    expect(deps.plan.get(FRIDAY, 'dinner')).toMatchObject({ recipeSlug: 'tacos', multiplier: 2, pinned: true });
    expect(mealsOffOn(deps, FRIDAY, THURSDAY)).toEqual([]);
    expect(keepPlanCookable(deps, THURSDAY)).toEqual([]);
    expect(onPlan(deps)).toBe('tacos');
  });
  it('leaves its leftovers gone, and whatever is in their slot', () => {
    const deps = house(null);
    const leftovers = { ...blankEntry('2026-11-14', 'lunch'), kind: 'leftovers' as const, leftoversOf: { date: FRIDAY, slot: 'dinner' as const } };
    deps.plan.upsert(leftovers);
    expect(keepPlanCookable(deps, THURSDAY)).toHaveLength(2);
    deps.plan.upsert(meal('2026-11-14', 'toast', { slot: 'lunch' }));

    putMealBack(deps, FRIDAY, 'dinner', THURSDAY);
    expect(deps.plan.get('2026-11-14', 'lunch')?.recipeSlug).toBe('toast');
  });
  it('can’t go back twice, or once its day has gone', () => {
    const deps = taken();
    putMealBack(deps, FRIDAY, 'dinner', THURSDAY);
    expect(() => putMealBack(deps, FRIDAY, 'dinner', THURSDAY)).toThrow();
    const other = taken();
    expect(() => putMealBack(other, FRIDAY, 'dinner', NEXT_TRIP)).toThrow();
  });
});
