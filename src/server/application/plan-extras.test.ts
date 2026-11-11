// Extras through the check-in and cook mode, once and only once.
import { describe, expect, it } from 'vitest';
import { blankEntry } from '../../domain/plan.ts';
import { recipe } from '../../domain/test-fixtures.ts';
import { checkinView, confirmPlannedMeals, recordMeal, recordPantry } from './checkin.ts';
import { settleCookedMeal } from './cooking.ts';
import { finishCooking } from './test-support/cook-meal.ts';
import { setMealDone } from './meal-updates.ts';
import { plannedRecipe, TODAY, transactionalFakes } from './test-support/transactional-fakes.ts';

const CAKE = 'extra-1' as const;
const cake = recipe('cake', ['4 eggs', '1 lb flour', '1 cup sugar'], { title: 'Birthday cake' });
const flour = [{ storage: 'fresh' as const, amount: 3, unit: 'lb' as const, canOz: null, useBy: null, useByEstimated: false }];
const nothing = { counts: [], needs: [], uses: [] };

function setUp(over = {}) {
  const f = transactionalFakes([cake, recipe('stew', ['1 lb beef'])]);
  const eggs = f.addItem('eggs', { count: 12 });
  const flourItem = f.addItem('flour', { portions: flour });
  f.deps.plan.upsert(plannedRecipe(TODAY, CAKE, 'cake', { pinned: true, multiplier: 2, ...over }));
  return { f, eggs, flourItem };
}

describe('an extra at the check-in', () => {
  it('asks about a made extra at its batch size, and takes off its portions at that size', () => {
    const { f, eggs, flourItem } = setUp();
    setMealDone(f.deps, TODAY, CAKE, true);
    f.deps.household.markCheckin(TODAY, 'meals');
    const { questions } = checkinView(f.deps, TODAY);
    expect(questions.counts).toEqual([{ pantryItemId: eggs.id, name: 'eggs', estimate: 8, onHand: 12 }]);
    recordPantry(f.deps, TODAY, { ...nothing, counts: [{ pantryItemId: eggs.id, used: 8 }] });
    expect(f.item(eggs.id).count).toBe(4);
    expect(f.item(flourItem.id).portions[0].amount).toBe(1);
    expect(f.deps.plan.get(TODAY, CAKE)?.checkinSettled).toBe(true);
  });

  it('comes off once, however many check-ins follow', () => {
    const { f, flourItem } = setUp();
    setMealDone(f.deps, TODAY, CAKE, true);
    recordPantry(f.deps, TODAY, nothing);
    recordPantry(f.deps, TODAY, nothing);
    recordPantry(f.deps, '2026-11-05', nothing);
    expect(f.item(flourItem.id).portions[0].amount).toBe(1);
  });

  it('asks nothing about an extra nobody says they made, and it doesn’t come off', () => {
    const { f, flourItem } = setUp();
    f.deps.household.markCheckin(TODAY, 'meals');
    expect(checkinView(f.deps, TODAY).questions).toEqual({ counts: [], needs: [], uses: [] });
    recordPantry(f.deps, TODAY, nothing);
    expect(f.item(flourItem.id).portions[0].amount).toBe(3);
    expect(f.deps.plan.get(TODAY, CAKE)?.checkinSettled).toBe(false);
  });

  it('marked made after its day’s check-in, it comes off at the next one', () => {
    const { f, flourItem } = setUp();
    recordPantry(f.deps, TODAY, nothing);
    setMealDone(f.deps, TODAY, CAKE, true);
    f.deps.household.markCheckin('2026-11-05', 'meals');
    expect(checkinView(f.deps, '2026-11-05').carried).toEqual([{ date: TODAY, slot: CAKE, title: 'Birthday cake' }]);
    recordPantry(f.deps, '2026-11-05', nothing);
    expect(f.item(flourItem.id).portions[0].amount).toBe(1);
  });

  it('ticked, unticked and ticked again after settling, it stays off once', () => {
    const { f, flourItem } = setUp();
    setMealDone(f.deps, TODAY, CAKE, true);
    recordPantry(f.deps, TODAY, nothing);
    setMealDone(f.deps, TODAY, CAKE, false);
    setMealDone(f.deps, TODAY, CAKE, true);
    recordPantry(f.deps, '2026-11-05', nothing);
    expect(f.item(flourItem.id).portions[0].amount).toBe(1);
  });

  it('“we ate what was planned” counts it as made', () => {
    const { f, flourItem } = setUp();
    confirmPlannedMeals(f.deps, TODAY);
    expect(f.deps.plan.get(TODAY, CAKE)?.outcome).toBe('made');
    recordPantry(f.deps, TODAY, nothing);
    expect(f.item(flourItem.id).portions[0].amount).toBe(1);
  });

  it('says nothing about an extra that isn’t on the plan any more', () => {
    const { f } = setUp();
    recordMeal(f.deps, { date: TODAY, slot: 'extra-99', outcome: 'made', recipeSlug: null, note: null });
    expect(f.deps.plan.get(TODAY, 'extra-99')).toBeNull();
  });

  it('counts the same item for an extra and a meal together', () => {
    const { f, eggs } = setUp();
    f.deps.plan.upsert(plannedRecipe(TODAY, 'breakfast', 'cake', { multiplier: 1, outcome: 'made' }));
    setMealDone(f.deps, TODAY, CAKE, true);
    f.deps.household.markCheckin(TODAY, 'meals');
    expect(checkinView(f.deps, TODAY).questions.counts[0]).toMatchObject({ pantryItemId: eggs.id, estimate: 12 });
  });
});

describe('an extra in cook mode', () => {
  it('records against the extra, not the meal of the hour', () => {
    const { f } = setUp();
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'stew'));
    const meal = finishCooking(f.deps, { slug: 'cake', factor: 1.5, today: TODAY, hour: 18, date: TODAY, slot: CAKE });
    expect(meal).toEqual({ date: TODAY, slot: CAKE });
    expect(f.deps.plan.get(TODAY, CAKE)).toMatchObject({ outcome: 'made', multiplier: 1.5 });
    expect(f.deps.plan.get(TODAY, 'dinner')?.outcome).toBeNull();
  });

  it('finds today’s extra when the recipe was opened from the book', () => {
    const { f } = setUp();
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'stew'));
    expect(finishCooking(f.deps, { slug: 'cake', factor: 2, today: TODAY, hour: 18 }).slot).toBe(CAKE);
    expect(f.deps.plan.get(TODAY, 'dinner')?.outcome).toBeNull();
  });

  it('takes off what the swaps really used', () => {
    const f = transactionalFakes([recipe('cake', ['2 eggs'], { title: 'Cake' })]);
    const eggs = f.addItem('eggs', { count: 12 });
    const applesauce = f.addItem('applesauce');
    f.deps.plan.upsert(plannedRecipe(TODAY, CAKE, 'cake'));
    finishCooking(f.deps, { slug: 'cake', factor: 1, today: TODAY, hour: 18, date: TODAY, slot: CAKE, substituted: { 0: 'applesauce' } });
    f.deps.household.markCheckin(TODAY, 'meals');
    const { questions } = checkinView(f.deps, TODAY);
    expect(questions.counts.map(q => q.pantryItemId)).not.toContain(eggs.id);
    expect(questions.needs).toEqual([{ pantryItemId: applesauce.id, name: 'applesauce', usedIn: 'Cake', answer: 'fine' }]);
  });

  it('leaves a saved cook review to itself at the check-in', () => {
    const { f, flourItem } = setUp();
    finishCooking(f.deps, { slug: 'cake', factor: 2, today: TODAY, hour: 18, date: TODAY, slot: CAKE });
    settleCookedMeal(f.deps, TODAY, CAKE);
    f.deps.household.markCheckin(TODAY, 'meals');
    expect(checkinView(f.deps, TODAY).questions.counts).toEqual([]);
    recordPantry(f.deps, TODAY, nothing);
    expect(f.item(flourItem.id).portions[0].amount).toBe(3);
  });

  it('keeps what was cooked, even if the extra came off the plan meanwhile', () => {
    const f = transactionalFakes([cake]);
    finishCooking(f.deps, { slug: 'cake', factor: 1, today: TODAY, hour: 18, date: TODAY, slot: 'extra-7' });
    expect(f.deps.plan.get(TODAY, 'extra-7')).toMatchObject({ ...blankEntry(TODAY, 'extra-7'), outcome: 'swapped', outcomeSlug: 'cake', pinned: false });
  });
});
