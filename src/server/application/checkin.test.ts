import { describe, expect, it } from 'vitest';
import { addDays } from '../../domain/dates.ts';
import { checkinView, confirmPlannedMeals, recordMeal, recordPantry } from './checkin.ts';
import { finishCooking } from './test-support/cook-meal.ts';
import { recipe } from '../../domain/test-fixtures.ts';
import { failOnce, plannedRecipe, TODAY, transactionalFakes } from './test-support/transactional-fakes.ts';

const report = (eggs: number, used: number) => ({ counts: [{ pantryItemId: eggs, used }], needs: [], uses: [] });

describe('settling the check-in', () => {
  it('takes counted items off once when the same report is sent again', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 12 });
    recordPantry(f.deps, TODAY, report(eggs.id, 3));
    recordPantry(f.deps, TODAY, report(eggs.id, 3));
    expect(f.item(eggs.id).count).toBe(9);
  });

  it('leaves answers from a second report alone too', () => {
    const f = transactionalFakes();
    const milk = f.addItem('milk');
    recordPantry(f.deps, TODAY, { counts: [], needs: [{ pantryItemId: milk.id, answer: 'fine' }], uses: [] });
    recordPantry(f.deps, TODAY, { counts: [], needs: [{ pantryItemId: milk.id, answer: 'out' }], uses: [] });
    expect(f.item(milk.id).status).toBe('have');
  });

  it('keeps nothing from a report that fails, so trying again counts once', () => {
    const f = transactionalFakes([recipe('stew', ['1 lb beef'])]);
    const eggs = f.addItem('eggs', { count: 12 });
    const beef = f.addItem('beef', { portions: [{ storage: 'fresh', amount: 3, unit: 'lb', canOz: null, useBy: null, useByEstimated: false }] });
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'stew', { outcome: 'made' }));
    failOnce(f.ports.household, 'markCheckin');

    expect(() => recordPantry(f.deps, TODAY, report(eggs.id, 3))).toThrow();
    expect(f.item(eggs.id).count).toBe(12);
    expect(f.item(beef.id).portions[0].amount).toBe(3);
    expect(f.deps.household.checkin(TODAY).pantryDone).toBe(false);

    recordPantry(f.deps, TODAY, report(eggs.id, 3));
    expect(f.item(eggs.id).count).toBe(9);
    expect(f.item(beef.id).portions[0].amount).toBe(2);
    expect(f.deps.household.checkin(TODAY).pantryDone).toBe(true);
  });

  it('marks meals and the step together', () => {
    const f = transactionalFakes();
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'stew'));
    failOnce(f.ports.household, 'markCheckin');
    expect(() => confirmPlannedMeals(f.deps, TODAY)).toThrow();
    expect(f.entry(TODAY, 'dinner')?.outcome).toBeNull();
  });
});

const fresh = (amount: number) => ({ storage: 'fresh' as const, amount, unit: 'lb' as const, canOz: null, useBy: null, useByEstimated: false });
const nothing = { counts: [], needs: [], uses: [] };
const TOMORROW = addDays(TODAY, 1);

describe('a meal cooked after its day’s check-in', () => {
  function afterTheCheckin() {
    const f = transactionalFakes([recipe('stew', ['2 eggs', '1 lb beef'])]);
    const eggs = f.addItem('eggs', { count: 12 });
    const beef = f.addItem('beef', { portions: [fresh(3)] });
    recordPantry(f.deps, TODAY, nothing);
    finishCooking(f.deps, { slug: 'stew', factor: 1, today: TODAY, hour: 20, date: TODAY, slot: 'dinner' });
    f.deps.household.markCheckin(TOMORROW, 'meals');
    return { f, eggs, beef };
  }

  it('comes off at the next check-in', () => {
    const { f, eggs, beef } = afterTheCheckin();
    const view = checkinView(f.deps, TOMORROW);
    expect(view.questions.counts).toEqual([expect.objectContaining({ pantryItemId: eggs.id, estimate: 2 })]);
    expect(view.carried).toEqual([{ date: TODAY, slot: 'dinner', title: 'stew' }]);

    recordPantry(f.deps, TOMORROW, { ...nothing, counts: [{ pantryItemId: eggs.id, used: 2 }] });
    expect(f.item(eggs.id).count).toBe(10);
    expect(f.item(beef.id).portions[0].amount).toBe(2);
  });

  it('isn’t asked about or taken off a second time', () => {
    const { f, eggs, beef } = afterTheCheckin();
    recordPantry(f.deps, TOMORROW, { ...nothing, counts: [{ pantryItemId: eggs.id, used: 2 }] });

    const dayAfter = addDays(TOMORROW, 1);
    f.deps.household.markCheckin(dayAfter, 'meals');
    expect(checkinView(f.deps, dayAfter)).toMatchObject({ carried: [], questions: { counts: [] } });
    recordPantry(f.deps, dayAfter, nothing);
    expect(f.item(beef.id).portions[0].amount).toBe(2);
  });

  it('settles together with the report, or not at all', () => {
    const { f, beef } = afterTheCheckin();
    failOnce(f.ports.household, 'markCheckin');
    expect(() => recordPantry(f.deps, TOMORROW, nothing)).toThrow();
    expect(f.item(beef.id).portions[0].amount).toBe(3);
    expect(f.entry(TODAY, 'dinner')?.checkinSettled).toBe(false);
  });

  it('gives up on one more than a week old', () => {
    const { f, beef } = afterTheCheckin();
    const muchLater = addDays(TODAY, 8);
    recordPantry(f.deps, muchLater, nothing);
    expect(f.item(beef.id).portions[0].amount).toBe(3);
  });

  it('counts a day that never had a check-in too', () => {
    const f = transactionalFakes([recipe('stew', ['1 lb beef'])]);
    const beef = f.addItem('beef', { portions: [fresh(3)] });
    finishCooking(f.deps, { slug: 'stew', factor: 1, today: TODAY, hour: 20, date: TODAY, slot: 'dinner' });
    recordPantry(f.deps, TOMORROW, nothing);
    expect(f.item(beef.id).portions[0].amount).toBe(2);
  });

  it('doesn’t carry a meal the check-in it was on already took off', () => {
    const f = transactionalFakes([recipe('stew', ['1 lb beef'])]);
    const beef = f.addItem('beef', { portions: [fresh(3)] });
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'stew', { outcome: 'made' }));
    recordPantry(f.deps, TODAY, nothing);
    recordPantry(f.deps, TOMORROW, nothing);
    expect(f.item(beef.id).portions[0].amount).toBe(2);
  });

  it('takes off a same-day meal once when it’s cooked after the check-in already covered it', () => {
    const f = transactionalFakes([recipe('stew', ['1 lb beef'])]);
    const beef = f.addItem('beef', { portions: [fresh(3)] });
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'stew', { outcome: 'made' }));
    recordPantry(f.deps, TODAY, nothing);
    finishCooking(f.deps, { slug: 'stew', factor: 1, today: TODAY, hour: 20, date: TODAY, slot: 'dinner' });
    recordPantry(f.deps, TOMORROW, nothing);
    expect(f.item(beef.id).portions[0].amount).toBe(2);
  });

  it('answers a drafted meal’s uses for the right day when two share a slot', () => {
    const f = transactionalFakes();
    const rice = f.addItem('rice');
    const beans = f.addItem('beans');
    const uses = (id: number, name: string) => ({ how: null, uses: [{ pantryItemId: id, name, text: 'some', amount: null, unit: null, leaves: 'have' as const }] });
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'none', { kind: 'note', recipeSlug: null, outcome: 'made', drafted: uses(rice.id, 'rice') }));
    f.deps.plan.upsert(plannedRecipe(TOMORROW, 'dinner', 'none', { kind: 'note', recipeSlug: null, outcome: 'made', drafted: uses(rice.id, 'rice') }));
    f.deps.plan.upsert(plannedRecipe(TOMORROW, 'lunch', 'none', { kind: 'note', recipeSlug: null, outcome: 'made', drafted: uses(beans.id, 'beans') }));
    recordPantry(f.deps, TOMORROW, { ...nothing, uses: [{ date: TODAY, slot: 'dinner', pantryItemId: rice.id, answer: 'unused' }, { date: TOMORROW, slot: 'dinner', pantryItemId: rice.id, answer: 'low' }] });
    expect(f.item(rice.id).status).toBe('low');
    expect(f.item(beans.id).status).toBe('have');
  });
});

describe('swaps chosen in cook mode', () => {
  const swapped = () => {
    const f = transactionalFakes([recipe('cake', ['2 eggs', '1 cup sugar']), recipe('tacos', ['1 lb beef', '1 cup sugar'])]);
    const eggs = f.addItem('eggs', { count: 12 });
    const applesauce = f.addItem('applesauce', { portions: [{ storage: 'fresh', amount: 2, unit: 'cup', canOz: null, useBy: null, useByEstimated: false }] });
    const sugar = f.addItem('sugar', { portions: [{ storage: 'fresh', amount: 5, unit: 'cup', canOz: null, useBy: null, useByEstimated: false }] });
    const honey = f.addItem('honey', { portions: [{ storage: 'fresh', amount: 2, unit: 'cup', canOz: null, useBy: null, useByEstimated: false }] });
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'cake'));
    finishCooking(f.deps, { slug: 'cake', factor: 1, today: TODAY, hour: 18, date: TODAY, slot: 'dinner', substituted: { 0: 'applesauce', 1: 'honey' } });
    f.deps.household.markCheckin(TODAY, 'meals');
    return { f, eggs, applesauce, sugar, honey };
  };

  it('come off at the check-in instead of the original, with no review', () => {
    const { f, eggs, applesauce, sugar, honey } = swapped();
    expect(checkinView(f.deps, TODAY).questions.counts).toEqual([]);
    recordPantry(f.deps, TODAY, nothing);
    expect(f.item(eggs.id).count).toBe(12);
    expect(f.item(sugar.id).portions[0].amount).toBe(5);
    expect(f.item(applesauce.id).portions[0].amount).toBe(1.5);
    expect(f.item(honey.id).portions[0].amount).toBe(1.25);
  });

  it('don’t follow the meal when it turns out to be a different dish', () => {
    const { f } = swapped();
    recordMeal(f.deps, { date: TODAY, slot: 'dinner', outcome: 'swapped', recipeSlug: 'tacos', note: null });
    expect(f.entry(TODAY, 'dinner')?.substituted).toBeNull();
  });

  it('stay when the check-in only confirms the same dish', () => {
    const { f } = swapped();
    recordMeal(f.deps, { date: TODAY, slot: 'dinner', outcome: 'made', recipeSlug: null, note: null });
    expect(f.entry(TODAY, 'dinner')?.substituted).toEqual({ 0: 'applesauce', 1: 'honey' });
  });
});
