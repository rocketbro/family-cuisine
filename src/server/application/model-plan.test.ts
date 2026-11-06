import { describe, expect, it } from 'vitest';
import { recipe } from '../../domain/test-fixtures.ts';
import { validPlan } from './model-plan.ts';
import { plannerContext } from './planner-context.ts';
import { fakeDeps } from './test-support/full-deps-fake.ts';
import type { PlannedMeal } from './ports/ai.ts';

const DATE = '2030-01-07';
const planned = (recipeSlug: string): PlannedMeal => ({ date: DATE, slot: 'dinner', kind: 'recipe', recipeSlug }) as PlannedMeal;
const cake = recipe('cake', [], { meals: ['extra'] });
const muffins = recipe('muffins', [], { meals: ['breakfast', 'extra'] });
const chili = recipe('chili', []);

describe('planning around extras', () => {
  it('won’t put an extra on the plan, even if the model asks', () => {
    const deps = fakeDeps({ recipes: [cake, chili] });
    const dates = new Set([DATE]);
    expect(validPlan(deps, [planned('cake')], [cake, chili], dates, new Set())).toEqual([]);
    expect(validPlan(deps, [planned('chili')], [cake, chili], dates, new Set())).toHaveLength(1);
  });

  it('doesn’t show the model extras, and shows a dish that is both only as its meal', () => {
    const deps = fakeDeps({ recipes: [cake, muffins, chili] });
    const { recipes } = plannerContext(deps, [cake, muffins, chili], [DATE], [], []);
    expect(recipes.map(r => [r.slug, r.meals])).toEqual([['muffins', ['breakfast']], ['chili', ['dinner']]]);
  });
});
