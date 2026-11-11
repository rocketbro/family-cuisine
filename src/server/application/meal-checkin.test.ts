import { describe, expect, it } from 'vitest';
import { checkinView } from './checkin.ts';
import { markMeal } from './checkin-meal.ts';
import { mealQuestions, settleMeal } from './meal-checkin.ts';
import { recipe } from '../../domain/test-fixtures.ts';
import { plannedRecipe, TODAY, transactionalFakes } from './test-support/transactional-fakes.ts';

const none = { counts: [], needs: [], uses: [] };

function lunchChecked() {
  const f = transactionalFakes([recipe('toast', ['- 2 slices bread', '- 2 eggs'])]);
  const bread = f.addItem('bread');
  const eggs = f.addItem('eggs', { count: 12 });
  f.deps.plan.upsert(plannedRecipe(TODAY, 'lunch', 'toast'));
  markMeal(f.deps, TODAY, 'lunch', { outcome: 'made' });
  return { f, bread, eggs };
}

describe('checking a meal off on Today', () => {
  it('asks only about that meal', () => {
    const { f, bread, eggs } = lunchChecked();
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'toast', { outcome: 'made' }));
    const { questions, anyLeft } = mealQuestions(f.deps, TODAY, 'lunch');
    expect(questions.needs.map(n => n.pantryItemId)).toEqual([bread.id]);
    expect(questions.counts.map(n => n.pantryItemId)).toEqual([eggs.id]);
    expect(anyLeft).toBeNull();
    expect(mealQuestions(f.deps, TODAY, 'dinner').anyLeft).toEqual({ answer: null });
  });

  it('settles the pantry once, so the evening check-in no longer asks about it', () => {
    const { f, bread, eggs } = lunchChecked();
    const report = { counts: [{ pantryItemId: eggs.id, used: 2 }], needs: [{ pantryItemId: bread.id, answer: 'low' as const }], uses: [] };
    settleMeal(f.deps, TODAY, 'lunch', report);
    settleMeal(f.deps, TODAY, 'lunch', report);
    expect(f.item(eggs.id).count).toBe(10);
    expect(f.item(bread.id).status).toBe('low');
    f.deps.household.markCheckin(TODAY, 'meals');
    const { questions } = checkinView(f.deps, TODAY);
    expect(questions).toEqual({ counts: [], needs: [], uses: [] });
    expect(f.item(eggs.id).count).toBe(10);
  });

  it('can be unchecked and checked again without asking or taking off twice', () => {
    const { f, eggs } = lunchChecked();
    settleMeal(f.deps, TODAY, 'lunch', { counts: [{ pantryItemId: eggs.id, used: 2 }], needs: [], uses: [] });
    f.deps.plan.upsert({ ...f.deps.plan.get(TODAY, 'lunch')!, outcome: null });
    markMeal(f.deps, TODAY, 'lunch', { outcome: 'made' });
    expect(f.deps.plan.get(TODAY, 'lunch')?.outcome).toBe('made');
    expect(mealQuestions(f.deps, TODAY, 'lunch').questions.counts).toEqual([]);
    expect(f.item(eggs.id).count).toBe(10);
  });

  it('refuses questions for a meal not marked', () => {
    const f = transactionalFakes([recipe('toast', ['- 2 eggs'])]);
    f.deps.plan.upsert(plannedRecipe(TODAY, 'lunch', 'toast'));
    expect(() => mealQuestions(f.deps, TODAY, 'lunch')).toThrow();
    expect(() => settleMeal(f.deps, TODAY, 'lunch', none)).toThrow();
  });
});
