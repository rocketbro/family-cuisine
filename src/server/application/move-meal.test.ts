import { describe, expect, it } from 'vitest';
import { recipe } from '../../domain/test-fixtures.ts';
import { blankEntry } from '../../domain/plan.ts';
import { moveMeal } from './move-meal.ts';
import { planView } from './plan-view.ts';
import { failOnce, plannedRecipe, TODAY, transactionalFakes } from './test-support/transactional-fakes.ts';

const TOMORROW = '2026-11-05';
const FRIDAY = '2026-11-06';
const dinner = (date = TODAY) => ({ date, slot: 'dinner' as const });

function setUp() {
  const f = transactionalFakes([recipe('tacos', ['1 lb beef']), recipe('red-beans', ['1 lb beans'])]);
  return { f, plan: f.deps.plan };
}

describe('moving a meal', () => {
  it('trades places, carrying the meal’s size and draft, and pins both', () => {
    const { f, plan } = setUp();
    const drafted = { how: 'With rice', uses: [] };
    plan.upsert(plannedRecipe(TODAY, 'dinner', 'tacos', { multiplier: 2, drafted }));
    plan.upsert(plannedRecipe(TOMORROW, 'dinner', 'red-beans'));
    moveMeal(f.deps, dinner(), TOMORROW, TODAY);
    expect(f.entry(TOMORROW, 'dinner')).toMatchObject({ recipeSlug: 'tacos', multiplier: 2, drafted, pinned: true });
    expect(f.entry(TODAY, 'dinner')).toMatchObject({ recipeSlug: 'red-beans', multiplier: 1, drafted: null, pinned: true });
  });

  it('leaves the old slot open when the other day was open', () => {
    const { f, plan } = setUp();
    plan.upsert(plannedRecipe(TODAY, 'dinner', 'tacos'));
    moveMeal(f.deps, dinner(), TOMORROW, TODAY);
    expect(f.entry(TODAY, 'dinner')).toBeNull();
    expect(f.entry(TOMORROW, 'dinner')).toMatchObject({ recipeSlug: 'tacos', pinned: true });
  });

  it('only touches that slot', () => {
    const { f, plan } = setUp();
    plan.upsert(plannedRecipe(TODAY, 'dinner', 'tacos'));
    plan.upsert(plannedRecipe(TOMORROW, 'breakfast', 'red-beans'));
    moveMeal(f.deps, dinner(), TOMORROW, TODAY);
    expect(f.entry(TOMORROW, 'breakfast')).toMatchObject({ recipeSlug: 'red-beans', pinned: false });
  });

  it('refuses meals with an outcome on either side, and a past day, and changes nothing', () => {
    const { f, plan } = setUp();
    plan.upsert(plannedRecipe(TODAY, 'dinner', 'tacos'));
    plan.upsert(plannedRecipe(TOMORROW, 'dinner', 'red-beans', { outcome: 'made' }));
    expect(() => moveMeal(f.deps, dinner(), TOMORROW, TODAY)).toThrow(/already been recorded/);
    expect(() => moveMeal(f.deps, dinner(), '2026-11-03', TODAY)).toThrow(/gone by/);
    expect(() => moveMeal(f.deps, dinner(TOMORROW), FRIDAY, TODAY)).toThrow(/already been recorded/);
    expect(f.entry(TODAY, 'dinner')).toMatchObject({ recipeSlug: 'tacos', pinned: false });
  });

  it('keeps leftovers on the moved dinner, so they name it and not what traded in', () => {
    const { f, plan } = setUp();
    plan.upsert(plannedRecipe(TOMORROW, 'dinner', 'tacos'));
    plan.upsert(plannedRecipe(TODAY, 'dinner', 'red-beans'));
    plan.upsert({ ...blankEntry(FRIDAY, 'lunch'), kind: 'leftovers', leftoversOf: dinner(TOMORROW) });
    moveMeal(f.deps, dinner(TOMORROW), TODAY, TODAY);
    expect(f.entry(FRIDAY, 'lunch')?.leftoversOf).toEqual(dinner(TODAY));
    expect(planView(f.deps, FRIDAY, FRIDAY)[0].leftoversTitle).toBe(f.deps.recipes.get('tacos')!.title);
  });

  it('is all or nothing', () => {
    const { f, plan } = setUp();
    plan.upsert(plannedRecipe(TODAY, 'dinner', 'tacos'));
    plan.upsert(plannedRecipe(TOMORROW, 'dinner', 'red-beans'));
    plan.upsert({ ...blankEntry(TOMORROW, 'lunch'), kind: 'leftovers', leftoversOf: dinner() });
    failOnce(f.ports.plan, 'upsert', (entry: { slot: string }) => entry.slot === 'dinner');
    expect(() => moveMeal(f.deps, dinner(), TOMORROW, TODAY)).toThrow();
    expect(f.entry(TODAY, 'dinner')).toMatchObject({ recipeSlug: 'tacos', pinned: false });
    expect(f.entry(TOMORROW, 'dinner')).toMatchObject({ recipeSlug: 'red-beans', pinned: false });
    expect(f.entry(TOMORROW, 'lunch')).not.toBeNull();
  });
});
