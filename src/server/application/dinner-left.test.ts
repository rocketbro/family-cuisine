import { describe, expect, it } from 'vitest';
import { blankEntry, type PlanEntry } from '../../domain/plan.ts';
import { recipe } from '../../domain/test-fixtures.ts';
import { checkinView, recordMeal } from './checkin.ts';
import { leftoversInTheFridge, sayAnyLeft } from './dinner-left.ts';
import { planView } from './plan-view.ts';
import { plannedRecipe, TODAY, transactionalFakes } from './test-support/transactional-fakes.ts';

const TOMORROW = '2026-11-05';
const FRIDAY = '2026-11-06';
const source = { date: TODAY, slot: 'dinner' as const };
const lunch = (date: string, over: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(date, 'lunch'), kind: 'leftovers', leftoversOf: source, ...over });
const made = { date: TODAY, slot: 'dinner' as const, outcome: 'made' as const, recipeSlug: null, note: null };

function dinnerEaten() {
  const f = transactionalFakes([recipe('tacos', ['1 lb beef'])]);
  f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'tacos'));
  recordMeal(f.deps, made);
  return f;
}
const offered = (f: ReturnType<typeof dinnerEaten>) => planView(f.deps, TODAY, TODAY)[0].leftoversOffered;

describe('saying whether any dinner is left', () => {
  it('stops offering it after a no, and offers it again after a yes', () => {
    const f = dinnerEaten();
    expect(offered(f)).toBe(true);
    sayAnyLeft(f.deps, TODAY, 'none', TODAY);
    expect(offered(f)).toBe(false);
    sayAnyLeft(f.deps, TODAY, 'some', TODAY);
    expect(offered(f)).toBe(true);
  });

  it('offers a dinner that was only a name once someone says there’s some', () => {
    const f = transactionalFakes([]);
    f.deps.plan.upsert({ ...blankEntry(TODAY, 'dinner'), kind: 'note', note: 'Chili from the freezer' });
    recordMeal(f.deps, made);
    expect(offered(f)).toBe(false);
    sayAnyLeft(f.deps, TODAY, 'some', TODAY);
    expect(offered(f)).toBe(true);
  });

  it('takes planned leftovers off after a no, and leaves chosen ones as plain leftovers', () => {
    const f = dinnerEaten();
    f.deps.plan.upsert(lunch(TOMORROW));
    f.deps.plan.upsert(lunch(FRIDAY, { pinned: true }));
    sayAnyLeft(f.deps, TODAY, 'none', TODAY);
    expect(f.entry(TOMORROW, 'lunch')).toBeNull();
    expect(f.entry(FRIDAY, 'lunch')).toMatchObject({ kind: 'leftovers', leftoversOf: null, pinned: true });
  });

  it('leaves planned leftovers alone after a yes', () => {
    const f = dinnerEaten();
    f.deps.plan.upsert(lunch(TOMORROW));
    sayAnyLeft(f.deps, TODAY, 'some', TODAY);
    expect(f.entry(TOMORROW, 'lunch')?.leftoversOf).toEqual(source);
  });

  it('refuses a dinner nobody has marked as eaten', () => {
    const f = transactionalFakes([recipe('tacos', ['1 lb beef'])]);
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'tacos'));
    expect(() => sayAnyLeft(f.deps, TODAY, 'some', TODAY)).toThrow();
  });
});

describe('what the dice hear', () => {
  it('hears only a yes, on later days within reach', () => {
    const f = dinnerEaten();
    const title = (slug: string) => f.deps.recipes.get(slug)?.title ?? null;
    expect(leftoversInTheFridge(f.deps, TOMORROW, title)).toEqual([]);
    sayAnyLeft(f.deps, TODAY, 'some', TODAY);
    expect(leftoversInTheFridge(f.deps, TOMORROW, title)).toEqual([{ date: TODAY, title: f.deps.recipes.get('tacos')!.title }]);
    expect(leftoversInTheFridge(f.deps, TODAY, title)).toEqual([]);
    expect(leftoversInTheFridge(f.deps, '2026-11-10', title)).toEqual([]);
  });
});

describe('the check-in', () => {
  it('asks once the meals are done, with what’s been said so far', () => {
    const f = dinnerEaten();
    expect(checkinView(f.deps, TODAY).anyLeft).toBeNull();
    f.deps.household.markCheckin(TODAY, 'meals');
    expect(checkinView(f.deps, TODAY).anyLeft).toEqual({ answer: null });
    sayAnyLeft(f.deps, TODAY, 'none', TODAY);
    expect(checkinView(f.deps, TODAY).anyLeft).toEqual({ answer: 'none' });
  });
});
