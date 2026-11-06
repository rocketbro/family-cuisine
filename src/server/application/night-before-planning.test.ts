// What choosing on its own does with a recipe whose step needs the evening before, and what a person can do.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recipe } from '../../domain/test-fixtures.ts';
import { blankEntry } from '../../domain/plan.ts';
import { keepPlanCookable } from './keep-plan-cookable.ts';
import { householdView } from './household-profile.ts';
import { nightBeforeTime, saveNightBeforeTime } from './night-before-time.ts';
import { plannerContext } from './planner-context.ts';
import { planAhead } from './planning.ts';
import { planned, fakeDeps } from './test-support/full-deps-fake.ts';
import { UserError } from './user-error.ts';

const today = '2026-11-10';
const tomorrow = '2026-11-11';
const later = '2026-11-12';
const at = (time: string) => new Date(`${today}T${time}:00`);

const beans = recipe('beans', [], { nightBefore: 'Soak the beans overnight' });
const toast = recipe('toast', []);

beforeEach(() => void vi.useFakeTimers({ toFake: ['Date'] }));
afterEach(() => void vi.useRealTimers());

describe('the planner', () => {
  it('won’t rotate a recipe with a step onto today', async () => {
    vi.setSystemTime(at('12:00'));
    const deps = fakeDeps({ ai: false, recipes: [beans, toast], shopWeekday: 1 });
    await planAhead(deps, today, today);
    expect(deps.plan.get(today, 'dinner')?.recipeSlug).toBe('toast');
  });

  it('won’t put one on tomorrow after the reminder time, but will before it', async () => {
    vi.setSystemTime(at('17:30'));
    const late = fakeDeps({ ai: false, recipes: [beans], shopWeekday: 1 });
    await planAhead(late, tomorrow, tomorrow);
    expect(late.plan.get(tomorrow, 'dinner')).toBeNull();

    vi.setSystemTime(at('16:00'));
    const early = fakeDeps({ ai: false, recipes: [beans], shopWeekday: 1 });
    await planAhead(early, today, tomorrow);
    expect(early.plan.get(today, 'dinner')).toBeNull();
    expect(early.plan.get(tomorrow, 'dinner')?.recipeSlug).toBe('beans');
  });

  it('refuses the model’s choice when it’s too late, and lets it through for a later day', async () => {
    vi.setSystemTime(at('18:00'));
    const deps = fakeDeps({ recipes: [beans, toast], shopWeekday: 1 });
    deps.planMeals = () => Promise.resolve([planned(tomorrow, { recipeSlug: 'beans' }), planned(later, { recipeSlug: 'beans' })]);
    await planAhead(deps, today, later);
    expect(deps.plan.get(tomorrow, 'dinner')?.recipeSlug).toBe('toast');
    expect(deps.plan.get(later, 'dinner')?.recipeSlug).toBe('beans');
  });

  it('tells the model which recipes have a step and which dates are too late', () => {
    vi.setSystemTime(at('18:00'));
    const deps = fakeDeps({ recipes: [beans, toast] });
    const context = plannerContext(deps, [beans, toast], [today, tomorrow, later], [], []);
    expect(context.tooLateForNightBefore).toEqual([today, tomorrow]);
    expect(context.recipes.map(r => [r.slug, r.nightBefore])).toEqual([['beans', true], ['toast', false]]);
  });

  it('leaves a meal already on the plan, however late its step is', () => {
    vi.setSystemTime(at('18:00'));
    const deps = fakeDeps({ recipes: [beans], shopWeekday: 1 });
    deps.plan.upsert({ ...blankEntry(today, 'dinner'), kind: 'recipe', recipeSlug: 'beans' });
    deps.plan.upsert({ ...blankEntry(tomorrow, 'dinner'), kind: 'recipe', recipeSlug: 'beans' });
    expect(keepPlanCookable(deps, today)).toEqual([]);
  });
});

describe('the reminder time', () => {
  it('is 5:00 PM until someone sets one', () => {
    expect(nightBeforeTime(fakeDeps())).toEqual({ hour: 17, minute: 0 });
  });

  it('keeps what’s saved, and the household view says so', () => {
    const deps = fakeDeps();
    saveNightBeforeTime(deps, '16:45');
    expect(nightBeforeTime(deps)).toEqual({ hour: 16, minute: 45 });
    expect(householdView(deps).schedule.nightBeforeTime).toEqual({ hour: 16, minute: 45 });
  });

  it.each(['25:00', '5pm', '', '17:60', '7:00'])('refuses %j', time => {
    const deps = fakeDeps();
    expect(() => saveNightBeforeTime(deps, time)).toThrow(UserError);
    expect(nightBeforeTime(deps)).toEqual({ hour: 17, minute: 0 });
  });

  it('falls back to the default from a saved value it can’t read', () => {
    const deps = fakeDeps();
    deps.household.saveSetting('night_before_time', 'whenever');
    expect(nightBeforeTime(deps)).toEqual({ hour: 17, minute: 0 });
  });
});
