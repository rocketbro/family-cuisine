// What the planner and the dice are told about the fridge, and what they aren't.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pantryItem, recipe } from '../../domain/test-fixtures.ts';
import { addFridgeLine } from './fridge.ts';
import { rollMeal } from './pantry-meal.ts';
import { plannerContext } from './planner-context.ts';
import { fakeDeps } from './test-support/full-deps-fake.ts';

const TODAY = '2026-11-03';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-03T12:00:00'));
});
afterEach(() => void vi.useRealTimers());

const eggs = recipe('omelet', ['6 eggs'], { meals: ['dinner'] });
const stocked = [pantryItem(1, 'eggs', { count: 12 })];

function withFridge() {
  const deps = fakeDeps({ recipes: [eggs], pantry: stocked, ai: true });
  addFridgeLine(deps, 'old soup', '2026-10-01');
  addFridgeLine(deps, 'rice', TODAY);
  addFridgeLine(deps, 'sautéed onions and peppers', TODAY, '2026-11-01');
  return deps;
}

describe('the fridge in the planner', () => {
  it('lists live lines oldest first with their age, and keeps them out of the house list', () => {
    const deps = withFridge();
    const context = plannerContext(deps, [eggs], [TODAY], [], []);
    expect(context.fridge).toEqual([
      { text: 'sautéed onions and peppers', since: 'Sunday 2026-11-01', daysThere: 2 },
      { text: 'rice', since: 'Tuesday 2026-11-03', daysThere: 0 },
    ]);
    expect(context.inHouse).toEqual(['eggs']);
  });
});

describe('the fridge in the dice', () => {
  it('is the same list, and nothing in the pantry changes', async () => {
    const deps = withFridge();
    let context: Parameters<typeof deps.ai.draftMeal>[0] | undefined;
    deps.ai.draftMeal = given => {
      context = given;
      return Promise.resolve({ title: 'Eggs', why: '', how: null, recipeSlug: null, multiplier: 1, uses: [{ pantryName: 'eggs', text: '2', amount: 2, unit: null, leaves: 'have' }] });
    };
    await rollMeal(deps, TODAY, 'dinner', []);
    expect(context?.fridge.map(l => l.text)).toEqual(['sautéed onions and peppers', 'rice']);
    expect(context?.pantry.map(p => p.name)).toEqual(['eggs']);
  });
});
