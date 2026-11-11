import { describe, expect, it } from 'vitest';
import { blankEntry, type PlanEntry } from '../../domain/plan.ts';
import { recipe } from '../../domain/test-fixtures.ts';
import { checkinView, recordMeal } from './checkin.ts';
import { sayAnyLeft } from './dinner-left.ts';
import { fridgeLines } from './fridge.ts';
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

describe('the fridge', () => {
  it('gets the dish on a yes, dated that day, and loses it on a no', () => {
    const f = dinnerEaten();
    expect(fridgeLines(f.deps, TOMORROW)).toEqual([]);
    sayAnyLeft(f.deps, TODAY, 'some', TODAY);
    expect(fridgeLines(f.deps, TOMORROW)).toMatchObject([{ text: f.deps.recipes.get('tacos')!.title, since: TODAY, dinner: TODAY }]);
    sayAnyLeft(f.deps, TODAY, 'some', TODAY);
    expect(fridgeLines(f.deps, TOMORROW)).toHaveLength(1);
    sayAnyLeft(f.deps, TODAY, 'none', TODAY);
    expect(fridgeLines(f.deps, TOMORROW)).toEqual([]);
  });

  it('is named by a dinner that was only a name', () => {
    const f = transactionalFakes([]);
    f.deps.plan.upsert({ ...blankEntry(TODAY, 'dinner'), kind: 'note', note: 'Chili from the freezer' });
    recordMeal(f.deps, made);
    sayAnyLeft(f.deps, TODAY, 'some', TODAY);
    expect(fridgeLines(f.deps, TODAY).map(l => l.text)).toEqual(['Chili from the freezer']);
  });

  it('is emptied of that dinner when it is eaten as its planned leftovers', () => {
    const f = dinnerEaten();
    sayAnyLeft(f.deps, TODAY, 'some', TODAY);
    f.deps.plan.upsert(lunch(TOMORROW));
    recordMeal(f.deps, { date: TOMORROW, slot: 'lunch', outcome: 'made', recipeSlug: null, note: null });
    expect(fridgeLines(f.deps, TOMORROW)).toEqual([]);
  });

  it('leaves the pantry alone', () => {
    const f = dinnerEaten();
    const before = JSON.stringify(f.deps.pantry.list());
    sayAnyLeft(f.deps, TODAY, 'some', TODAY);
    expect(JSON.stringify(f.deps.pantry.list())).toBe(before);
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
