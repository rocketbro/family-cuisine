import { describe, expect, it } from 'vitest';
import { recipe } from '../../domain/test-fixtures.ts';
import { putBackMeal } from './put-back-meal.ts';
import { setMeal } from './set-meal.ts';
import { plannedRecipe, TODAY, transactionalFakes } from './test-support/transactional-fakes.ts';

const TOMORROW = '2026-11-05';
const eatingOut = { kind: 'note' as const, note: 'Eating out' };

function setUp() {
  const f = transactionalFakes([recipe('tacos', ['1 lb beef']), recipe('red-beans', ['1 lb beans'])]);
  f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'tacos', { multiplier: 2, drafted: { how: 'With rice', uses: [] } }));
  return f;
}

describe('replacing a meal', () => {
  it('says which recipe came off', async () => {
    const f = setUp();
    expect(await setMeal(f.deps, TODAY, 'dinner', eatingOut)).toMatchObject({ recipeSlug: 'tacos', multiplier: 2, title: expect.any(String) });
  });

  it('says nothing for a meal with no recipe, or the same dish', async () => {
    const f = setUp();
    expect(await setMeal(f.deps, TODAY, 'dinner', { kind: 'recipe', recipeSlug: 'tacos', multiplier: 1 })).toBeNull();
    await setMeal(f.deps, TODAY, 'dinner', eatingOut);
    expect(await setMeal(f.deps, TODAY, 'dinner', { kind: 'note', note: 'Sandwiches' })).toBeNull();
  });
});

describe('moving what came off', () => {
  it('puts it on an open day, whole and pinned, leaving the replacement', async () => {
    const f = setUp();
    const meal = (await setMeal(f.deps, TODAY, 'dinner', eatingOut))!;
    expect(putBackMeal(f.deps, meal, TOMORROW, TODAY)).toBeNull();
    expect(f.entry(TOMORROW, 'dinner')).toMatchObject({ recipeSlug: 'tacos', multiplier: 2, drafted: { how: 'With rice' }, pinned: true });
    expect(f.entry(TODAY, 'dinner')).toMatchObject({ note: 'Eating out' });
  });

  it('takes the place of what’s there, and offers that one in turn', async () => {
    const f = setUp();
    f.deps.plan.upsert(plannedRecipe(TOMORROW, 'dinner', 'red-beans'));
    const meal = (await setMeal(f.deps, TODAY, 'dinner', eatingOut))!;
    expect(putBackMeal(f.deps, meal, TOMORROW, TODAY)).toMatchObject({ date: TOMORROW, recipeSlug: 'red-beans' });
    expect(f.entry(TOMORROW, 'dinner')?.recipeSlug).toBe('tacos');
  });

  it('refuses a past day, a recorded meal and a recipe that’s gone', async () => {
    const f = setUp();
    f.deps.plan.upsert(plannedRecipe(TOMORROW, 'dinner', 'red-beans', { outcome: 'made' }));
    const meal = (await setMeal(f.deps, TODAY, 'dinner', eatingOut))!;
    expect(() => putBackMeal(f.deps, meal, '2026-11-03', TODAY)).toThrow(/gone by/);
    expect(() => putBackMeal(f.deps, meal, TOMORROW, TODAY)).toThrow(/already been recorded/);
    expect(() => putBackMeal(f.deps, { ...meal, recipeSlug: 'nope' }, TOMORROW, TODAY)).toThrow(/no longer exists/);
    expect(f.entry(TOMORROW, 'dinner')?.recipeSlug).toBe('red-beans');
  });
});
