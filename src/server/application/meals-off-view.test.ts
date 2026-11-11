import { describe, expect, it } from 'vitest';
import { recipe } from '../../domain/test-fixtures.ts';
import { dismissMealOff, rememberMealsOff } from './meals-off.ts';
import { mealsOffView } from './meals-off-view.ts';
import { plannedRecipe, TODAY, transactionalFakes } from './test-support/transactional-fakes.ts';

const off = { date: TODAY, slot: 'dinner' as const, title: 'Tacos', recipeSlug: 'tacos', multiplier: 1, why: 'no tortillas', told: false };

function setUp() {
  const f = transactionalFakes([recipe('tacos', ['1 lb beef']), recipe('soup', ['1 lb beans'])]);
  rememberMealsOff(f.deps, TODAY, [off]);
  return f;
}

describe('the meals off note', () => {
  it('names what is in the slot now, or nothing yet', () => {
    const f = setUp();
    expect(mealsOffView(f.deps, TODAY, TODAY)).toEqual([{ ...off, replacement: null }]);
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'soup'));
    expect(mealsOffView(f.deps, TODAY, TODAY)[0].replacement).toBe(f.deps.recipes.get('soup')!.title);
  });

  it('is gone once dismissed', () => {
    const f = setUp();
    dismissMealOff(f.deps, TODAY, 'dinner');
    expect(mealsOffView(f.deps, TODAY, TODAY)).toEqual([]);
  });
});
