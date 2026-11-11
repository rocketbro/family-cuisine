import { describe, expect, it } from 'vitest';
import { recipe } from '../../domain/test-fixtures.ts';
import { clearUpcomingPlan, upcomingPlanCount } from './clear-plan.ts';
import { failOnce, plannedRecipe, TODAY, transactionalFakes } from './test-support/transactional-fakes.ts';

const YESTERDAY = '2026-11-03';
const TOMORROW = '2026-11-05';
const CAKE = 'extra-1' as const;

function setUp() {
  const f = transactionalFakes([recipe('soup', ['1 cup broth'])]);
  return { f, plan: f.deps.plan };
}

describe('clearing the plan', () => {
  it('removes today’s and later meals and extras, and says how many', () => {
    const { f, plan } = setUp();
    plan.upsert(plannedRecipe(TODAY, 'dinner', 'soup', { pinned: true }));
    plan.upsert(plannedRecipe(TOMORROW, 'lunch', 'soup'));
    plan.upsert(plannedRecipe(TOMORROW, CAKE, 'soup', { pinned: true }));
    expect(upcomingPlanCount(f.deps, TODAY)).toBe(3);
    expect(clearUpcomingPlan(f.deps, TODAY)).toBe(3);
    expect(plan.range(TODAY, '9999-12-31')).toEqual([]);
    expect(upcomingPlanCount(f.deps, TODAY)).toBe(0);
  });

  it('keeps past days, eaten or not', () => {
    const { f, plan } = setUp();
    plan.upsert(plannedRecipe(YESTERDAY, 'dinner', 'soup'));
    plan.upsert(plannedRecipe(YESTERDAY, 'lunch', 'soup', { outcome: 'made' }));
    plan.upsert(plannedRecipe(YESTERDAY, CAKE, 'soup'));
    expect(clearUpcomingPlan(f.deps, TODAY)).toBe(0);
    expect(plan.range(YESTERDAY, YESTERDAY)).toHaveLength(3);
  });

  it('keeps anything with an outcome, today’s included', () => {
    const { f, plan } = setUp();
    plan.upsert(plannedRecipe(TODAY, 'breakfast', 'soup', { outcome: 'made' }));
    plan.upsert(plannedRecipe(TODAY, 'lunch', 'soup', { outcome: 'skipped' }));
    plan.upsert(plannedRecipe(TODAY, 'dinner', 'soup', { outcome: 'swapped', outcomeSlug: 'soup' }));
    plan.upsert(plannedRecipe(TODAY, CAKE, 'soup', { outcome: 'made' }));
    plan.upsert(plannedRecipe(TOMORROW, 'dinner', 'soup'));
    expect(clearUpcomingPlan(f.deps, TODAY)).toBe(1);
    expect(plan.range(TODAY, TODAY)).toHaveLength(4);
    expect(plan.range(TOMORROW, TOMORROW)).toEqual([]);
  });

  it('keeps an extra that came off the pantry and was unticked, as taking one off by hand does', () => {
    const { f, plan } = setUp();
    plan.upsert(plannedRecipe(TODAY, CAKE, 'soup', { checkinSettled: true }));
    expect(upcomingPlanCount(f.deps, TODAY)).toBe(0);
    expect(clearUpcomingPlan(f.deps, TODAY)).toBe(0);
    expect(plan.get(TODAY, CAKE)).not.toBeNull();
  });

  it('takes leftovers with their dinner, and leaves none pointing at an empty slot', () => {
    const { f, plan } = setUp();
    const source = { date: TODAY, slot: 'dinner' as const };
    plan.upsert(plannedRecipe(TODAY, 'dinner', 'soup'));
    plan.upsert({ ...plannedRecipe(TOMORROW, 'lunch', 'soup'), kind: 'leftovers', recipeSlug: null, leftoversOf: source });
    plan.upsert({ ...plannedRecipe(TOMORROW, 'dinner', 'soup'), kind: 'leftovers', recipeSlug: null, leftoversOf: source, checkinSettled: true });
    expect(clearUpcomingPlan(f.deps, TODAY)).toBe(2);
    expect(plan.get(TOMORROW, 'lunch')).toBeNull();
    expect(plan.get(TOMORROW, 'dinner')).toMatchObject({ kind: 'leftovers', leftoversOf: null });
  });

  it('puts everything back when one removal fails', () => {
    const { f, plan } = setUp();
    plan.upsert(plannedRecipe(TODAY, 'dinner', 'soup'));
    plan.upsert(plannedRecipe(TOMORROW, 'dinner', 'soup'));
    failOnce(f.ports.plan, 'remove', ((date: string) => date === TOMORROW) as never);
    expect(() => clearUpcomingPlan(f.deps, TODAY)).toThrow('disk I/O error');
    expect(plan.range(TODAY, TOMORROW)).toHaveLength(2);
  });
});
