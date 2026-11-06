// Every path that walks the plan, with extras in it: the planner never fills one, and what they use still counts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extrasOnly, mealsOnly } from '../../domain/plan-slot.ts';
import { pantryItem, recipe } from '../../domain/test-fixtures.ts';
import { keepPlanCookable } from './keep-plan-cookable.ts';
import { rollMeal } from './pantry-meal.ts';
import { pantryForPlanning } from './pantry-for-planning.ts';
import { plannerContext } from './planner-context.ts';
import { addExtra, changeExtra, removeExtra } from './plan-extras.ts';
import { planAhead } from './planning.ts';
import { saveMoneyView } from './save-money.ts';
import { shoppingWeek } from './shopping.ts';
import { fakeDeps, planned } from './test-support/full-deps-fake.ts';

// A Tuesday, with shopping on Wednesday: only today is held to the pantry.
const TODAY = '2026-11-03';
const AFTER_TRIP = '2026-11-05';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-03T12:00:00'));
});
afterEach(() => void vi.useRealTimers());

const cake = recipe('cake', ['6 eggs', '1 lb flour'], { title: 'Birthday cake', meals: [], serves: 12 });
const breakfast = recipe('toast', ['1 slice bread'], { meals: ['breakfast'] });
const lunch = recipe('soup', ['1 can broth'], { meals: ['lunch'] });
const dinner = recipe('omelet', ['6 eggs'], { meals: ['dinner'] });
const all = [cake, breakfast, lunch, dinner];
const stocked = [pantryItem(1, 'eggs', { count: 12 }), pantryItem(2, 'flour'), pantryItem(3, 'bread'), pantryItem(4, 'broth')];

describe('the planner and extras', () => {
  it('fills the three meals around an extra, and never an extra', async () => {
    const deps = fakeDeps({ recipes: all, pantry: stocked, ai: false });
    addExtra(deps, TODAY, { kind: 'recipe', recipeSlug: 'cake' });
    await planAhead(deps, TODAY, TODAY);
    const day = deps.plan.range(TODAY, TODAY);
    expect(mealsOnly(day).map(e => e.slot).sort()).toEqual(['breakfast', 'dinner', 'lunch']);
    expect(extrasOnly(day).map(e => e.recipeSlug)).toEqual(['cake']);
  });

  it('counts an extra as a full day isn’t: it doesn’t stand in for an open meal', async () => {
    const deps = fakeDeps({ recipes: all, pantry: stocked, ai: false });
    addExtra(deps, TODAY, { kind: 'note', note: 'Cake' });
    addExtra(deps, TODAY, { kind: 'note', note: 'Rolls' });
    addExtra(deps, TODAY, { kind: 'note', note: 'Pie' });
    await planAhead(deps, TODAY, TODAY);
    expect(mealsOnly(deps.plan.range(TODAY, TODAY))).toHaveLength(3);
  });

  it('ignores a slot the model makes up', async () => {
    const deps = fakeDeps({ recipes: all, pantry: stocked, ai: true });
    deps.planMeals = () => Promise.resolve([planned(TODAY, { slot: 'extra-9' as never, kind: 'recipe', recipeSlug: 'cake' })]);
    await planAhead(deps, TODAY, TODAY);
    expect(deps.plan.get(TODAY, 'extra-9')).toBeNull();
  });

  it('holds days before the groceries to what extras leave', async () => {
    const deps = fakeDeps({ recipes: [dinner], pantry: [pantryItem(1, 'eggs', { count: 6 })], ai: false });
    addExtra(deps, TODAY, { kind: 'recipe', recipeSlug: 'omelet' });
    const running = pantryForPlanning(deps, TODAY);
    expect(running.ready(dinner, 1)).toBe(false);
    await planAhead(deps, TODAY, TODAY);
    expect(deps.plan.get(TODAY, 'dinner')).toBeNull();
  });

  it('never takes off an extra the pantry can no longer cover', () => {
    const deps = fakeDeps({ recipes: all, pantry: [], ai: false });
    const slot = addExtra(deps, TODAY, { kind: 'recipe', recipeSlug: 'cake' });
    expect(keepPlanCookable(deps, TODAY)).toEqual([]);
    expect(deps.plan.get(TODAY, slot)?.recipeSlug).toBe('cake');
  });

  it('tells the model an extra is there, without giving it a slot to fill', () => {
    const deps = fakeDeps({ recipes: all, pantry: stocked, ai: true });
    addExtra(deps, TODAY, { kind: 'recipe', recipeSlug: 'cake' });
    const context = plannerContext(deps, all, [TODAY], [], deps.plan.range(TODAY, TODAY));
    expect(context.alreadyPlanned).toEqual([{ date: TODAY, slot: 'extra', title: 'Birthday cake' }]);
  });
});

describe('extras on the list', () => {
  it('needs what an extra needs, at its batch size, and names it', () => {
    const deps = fakeDeps({ recipes: all, pantry: [pantryItem(1, 'eggs', { count: 2 })], ai: false });
    addExtra(deps, AFTER_TRIP, { kind: 'recipe', recipeSlug: 'cake', multiplier: 2 });
    const eggs = shoppingWeek(deps, TODAY).lines.find(l => l.name === 'eggs');
    expect(eggs).toMatchObject({ neededFor: ['Birthday cake'], quantity: 10 });
  });

  it('sizes a new extra for the household', () => {
    const deps = fakeDeps({ recipes: all, pantry: stocked, ai: false });
    const slot = addExtra(deps, AFTER_TRIP, { kind: 'recipe', recipeSlug: 'cake' });
    expect(deps.plan.get(AFTER_TRIP, slot)).toMatchObject({ multiplier: 1, pinned: true, kind: 'recipe' });
  });

  it('adds nothing for a name with no recipe', () => {
    const deps = fakeDeps({ recipes: all, pantry: [], ai: false });
    addExtra(deps, AFTER_TRIP, { kind: 'note', note: 'Cake' });
    expect(shoppingWeek(deps, TODAY).lines).toEqual([]);
  });

  it('never offers to swap an extra to save money, but counts it', () => {
    const deps = fakeDeps({ recipes: [recipe('pricey', ['1 lb beef'], { meals: ['dinner'] }), recipe('cheap', ['1 lb beans'], { meals: ['dinner'] })], pantry: [pantryItem(1, 'beef'), pantryItem(2, 'beans')], ai: false });
    deps.prices.save(1, 'aldi', { cents: 900, source: 'typed', product: null });
    deps.prices.save(2, 'aldi', { cents: 100, source: 'typed', product: null });
    addExtra(deps, AFTER_TRIP, { kind: 'recipe', recipeSlug: 'pricey' });
    expect(saveMoneyView(deps).ideas).toEqual([]);
  });

  it('leaves extras out of the dice’s recent meals, and in what upcoming meals need', async () => {
    const deps = fakeDeps({ recipes: all, pantry: stocked, ai: true });
    addExtra(deps, '2026-11-02', { kind: 'recipe', recipeSlug: 'cake' });
    addExtra(deps, TODAY, { kind: 'recipe', recipeSlug: 'cake' });
    let context: Parameters<typeof deps.ai.draftMeal>[0] | undefined;
    deps.ai.draftMeal = given => {
      context = given;
      return Promise.resolve({ title: 'Eggs', why: '', how: null, recipeSlug: null, multiplier: 1, uses: [{ pantryName: 'eggs', text: '2', amount: 2, unit: null, leaves: 'have' }] });
    };
    await rollMeal(deps, TODAY, 'dinner', []);
    expect(context?.recentMeals).toEqual([]);
    expect(context?.upcoming.map(u => u.title)).toEqual(['Birthday cake']);
  });
});

describe('changing an extra', () => {
  it('turns a name into a recipe, and takes one off', () => {
    const deps = fakeDeps({ recipes: all, pantry: stocked, ai: false });
    const slot = addExtra(deps, TODAY, { kind: 'note', note: 'Cake' });
    changeExtra(deps, TODAY, slot, { kind: 'recipe', recipeSlug: 'cake' });
    expect(deps.plan.get(TODAY, slot)).toMatchObject({ kind: 'recipe', recipeSlug: 'cake', note: null });
    removeExtra(deps, TODAY, slot);
    expect(deps.plan.get(TODAY, slot)).toBeNull();
  });

  it('keeps an extra that has come off the pantry on the record', () => {
    const deps = fakeDeps({ recipes: all, pantry: stocked, ai: false });
    const slot = addExtra(deps, TODAY, { kind: 'recipe', recipeSlug: 'cake' });
    deps.plan.upsert({ ...deps.plan.get(TODAY, slot)!, outcome: 'made', checkinSettled: true });
    expect(() => removeExtra(deps, TODAY, slot)).toThrow(/stays on the record/);
    expect(() => changeExtra(deps, TODAY, slot, { kind: 'note', note: 'Pie' })).toThrow(/stays on the record/);
  });

  it('refuses a recipe that isn’t there', () => {
    const deps = fakeDeps({ recipes: all, pantry: stocked, ai: false });
    expect(() => addExtra(deps, TODAY, { kind: 'recipe', recipeSlug: 'nope' })).toThrow(/no longer exists/);
  });
});
