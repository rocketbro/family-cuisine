import { describe, expect, it } from 'vitest';
import { blankEntry, type PlanEntry } from './plan.ts';
import { danglingMeals, strandedLeftovers } from './tidy-fix-plan.ts';
import { TODAY, tidyInputs } from './tidy-fixtures.ts';
import { recipe } from './test-fixtures.ts';

const meal = (date: string, slot: 'breakfast' | 'lunch' | 'dinner', extra: Partial<PlanEntry>): PlanEntry => ({ ...blankEntry(date, slot), ...extra });

describe('a planned meal for a recipe that is gone', () => {
  const plan = [meal('2026-11-13', 'dinner', { kind: 'recipe', recipeSlug: 'gone' }), meal('2026-11-13', 'lunch', { kind: 'recipe', recipeSlug: 'soup' })];
  const recipes = [recipe('soup', [])];

  it('comes off, and only that one', () => {
    const fixes = danglingMeals({ plan, recipes, recipesTrustworthy: true });
    expect(fixes.map(f => f.step)).toEqual([{ step: 'remove_entry', date: '2026-11-13', slot: 'dinner' }]);
  });

  it('is left alone once recorded, since the pantry has already come off for it', () => {
    const recorded = [meal('2026-11-10', 'dinner', { kind: 'recipe', recipeSlug: 'gone', outcome: 'made' })];
    expect(danglingMeals({ plan: recorded, recipes, recipesTrustworthy: true })).toEqual([]);
  });

  it('is not judged while a recipe file could not be read', () => {
    expect(danglingMeals({ plan, recipes, recipesTrustworthy: false })).toEqual([]);
  });
});

describe('planned leftovers that can no longer be what they say', () => {
  const dinner = meal('2026-11-12', 'dinner', { kind: 'recipe', recipeSlug: 'soup', outcome: 'made' });
  const leftovers = (date: string, extra: Partial<PlanEntry> = {}) =>
    meal(date, 'lunch', { kind: 'leftovers', leftoversOf: { date: '2026-11-12', slot: 'dinner' }, ...extra });
  const run = (plan: PlanEntry[]) => strandedLeftovers(tidyInputs({ plan }));

  it('leaves leftovers within LEFTOVERS_LAST_DAYS alone', () => {
    expect(run([dinner, leftovers('2026-11-13'), leftovers('2026-11-15')])).toEqual([]);
  });

  it('takes the planner’s off when they come too long after the dinner', () => {
    expect(run([dinner, leftovers('2026-11-16')]).map(f => f.step)).toEqual([{ step: 'remove_entry', date: '2026-11-16', slot: 'lunch' }]);
  });

  it('makes a person’s own plain leftovers instead', () => {
    expect(run([dinner, leftovers('2026-11-16', { pinned: true })]).map(f => f.step)).toEqual([{ step: 'unlink_entry', date: '2026-11-16', slot: 'lunch' }]);
  });

  it('takes them off when the dinner is skipped or gone', () => {
    expect(run([{ ...dinner, outcome: 'skipped' }, leftovers('2026-11-13')])).toHaveLength(1);
    expect(run([leftovers('2026-11-13')])).toHaveLength(1);
  });

  it('never touches days gone by or leftovers already eaten', () => {
    expect(run([leftovers('2026-11-11'), leftovers('2026-11-20', { outcome: 'made' })])).toEqual([]);
    expect(TODAY).toBe('2026-11-12');
  });
});
