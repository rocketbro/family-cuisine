// Marking meals one at a time, and catching up on earlier days, through to what comes off the pantry.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays } from '../../domain/dates.ts';
import { blankEntry } from '../../domain/plan.ts';
import { recipe } from '../../domain/test-fixtures.ts';
import { sayNotAsPlanned } from './checkin-catch-up.ts';
import { markMeal } from './checkin-meal.ts';
import { checkinView, confirmPlannedMeals, recordPantry } from './checkin.ts';
import { plannedRecipe, TODAY, transactionalFakes } from './test-support/transactional-fakes.ts';

const YESTERDAY = addDays(TODAY, -1);
const TWO_DAYS_AGO = addDays(TODAY, -2);
const nothing = { counts: [], needs: [], uses: [] };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T20:00:00`));
});
afterEach(() => void vi.useRealTimers());

function household() {
  const f = transactionalFakes([recipe('stew', ['2 eggs', 'carrots']), recipe('soup', ['carrots'], { serves: 2 })]);
  const eggs = f.addItem('eggs', { count: 12 });
  const carrots = f.addItem('carrots');
  return { f, eggs, carrots };
}
/** The household has checked in before these days. */
const checkedInBefore = (f: ReturnType<typeof household>['f']) => f.deps.household.markCheckin(addDays(TODAY, -20), 'meals');

describe('marking a meal', () => {
  it('saves Made, and changes on the next tap', () => {
    const { f } = household();
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'stew'));
    markMeal(f.deps, TODAY, 'dinner', { outcome: 'made' });
    expect(f.entry(TODAY, 'dinner')?.outcome).toBe('made');
    markMeal(f.deps, TODAY, 'dinner', { outcome: 'skipped' });
    expect(f.entry(TODAY, 'dinner')?.outcome).toBe('skipped');
    markMeal(f.deps, TODAY, 'dinner', { outcome: 'other', name: 'Red beans' });
    expect(f.entry(TODAY, 'dinner')).toMatchObject({ outcome: 'swapped', outcomeSlug: null, note: 'Red beans' });
    markMeal(f.deps, TODAY, 'dinner', { outcome: 'made' });
    expect(f.entry(TODAY, 'dinner')).toMatchObject({ outcome: 'made', note: null });
  });

  it('needs no key for something else', () => {
    const { f } = household();
    f.deps.ai.available = () => false;
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'stew'));
    markMeal(f.deps, TODAY, 'dinner', { outcome: 'other', name: 'Red beans' });
    expect(f.entry(TODAY, 'dinner')?.note).toBe('Red beans');
  });

  it('brings back the name a meal was planned as', () => {
    const { f } = household();
    f.deps.plan.upsert({ ...blankEntry(TODAY, 'dinner'), note: 'Pizza night' });
    markMeal(f.deps, TODAY, 'dinner', { outcome: 'other', name: 'Tacos' });
    markMeal(f.deps, TODAY, 'dinner', { outcome: 'other', name: 'Soup' });
    expect(f.entry(TODAY, 'dinner')?.note).toBe('Soup');
    markMeal(f.deps, TODAY, 'dinner', { outcome: 'skipped' });
    expect(f.entry(TODAY, 'dinner')?.note).toBe('Pizza night');
  });

  it('goes back to the planned dish’s size from something else cooked', () => {
    const { f } = household();
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'stew', { outcome: 'swapped', outcomeSlug: 'soup', multiplier: 3 }));
    markMeal(f.deps, TODAY, 'dinner', { outcome: 'made' });
    expect(f.entry(TODAY, 'dinner')).toMatchObject({ outcome: 'made', outcomeSlug: null });
    expect(f.entry(TODAY, 'dinner')?.multiplier).not.toBe(3);
  });

  it('takes planned leftovers off a meal that turns out skipped or something else, and leaves them for one made', () => {
    const { f } = household();
    const leftovers = plannedRecipe(addDays(TODAY, 1), 'lunch', 'stew', { kind: 'leftovers', recipeSlug: null, leftoversOf: { date: TODAY, slot: 'dinner' } });
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'stew'));
    f.deps.plan.upsert(leftovers);
    markMeal(f.deps, TODAY, 'dinner', { outcome: 'made' });
    expect(f.entry(addDays(TODAY, 1), 'lunch')).not.toBeNull();
    markMeal(f.deps, TODAY, 'dinner', { outcome: 'other', name: 'Red beans' });
    expect(f.entry(addDays(TODAY, 1), 'lunch')).toBeNull();

    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'stew'));
    f.deps.plan.upsert(leftovers);
    markMeal(f.deps, TODAY, 'dinner', { outcome: 'skipped' });
    expect(f.entry(addDays(TODAY, 1), 'lunch')).toBeNull();
  });

  it('leaves a meal settled through cook mode or a check-in as it is', () => {
    const { f } = household();
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'stew', { outcome: 'made', pantrySettled: true }));
    f.deps.plan.upsert(plannedRecipe(TODAY, 'lunch', 'stew', { outcome: 'made', checkinSettled: true }));
    expect(() => markMeal(f.deps, TODAY, 'dinner', { outcome: 'skipped' })).toThrow();
    expect(() => markMeal(f.deps, TODAY, 'lunch', { outcome: 'skipped' })).toThrow();
    expect(f.entry(TODAY, 'dinner')?.outcome).toBe('made');
    expect(f.entry(TODAY, 'lunch')?.outcome).toBe('made');
  });

  it('refuses a meal no longer on the plan', () => {
    const { f } = household();
    expect(() => markMeal(f.deps, TODAY, 'dinner', { outcome: 'made' })).toThrow();
    expect(f.entry(TODAY, 'dinner')).toBeNull();
  });

  it('takes off only what was made', () => {
    const { f, eggs } = household();
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'stew'));
    f.deps.plan.upsert(plannedRecipe(TODAY, 'lunch', 'stew'));
    f.deps.plan.upsert(plannedRecipe(TODAY, 'breakfast', 'stew'));
    markMeal(f.deps, TODAY, 'dinner', { outcome: 'made' });
    markMeal(f.deps, TODAY, 'lunch', { outcome: 'skipped' });
    markMeal(f.deps, TODAY, 'breakfast', { outcome: 'other', name: 'Cereal' });
    confirmPlannedMeals(f.deps, TODAY);
    const { questions } = checkinView(f.deps, TODAY);
    expect(questions.counts).toEqual([{ pantryItemId: eggs.id, name: 'eggs', estimate: 2, onHand: 12 }]);
  });
});

describe('asking about earlier days', () => {
  it('doesn’t ask a household that has never checked in', () => {
    const { f } = household();
    f.deps.plan.upsert(plannedRecipe(YESTERDAY, 'dinner', 'stew'));
    expect(checkinView(f.deps, TODAY).earlier).toEqual([]);
  });

  it('asks about a day nobody marked, latest first, with its meals', () => {
    const { f } = household();
    checkedInBefore(f);
    f.deps.plan.upsert(plannedRecipe(TWO_DAYS_AGO, 'dinner', 'stew'));
    f.deps.plan.upsert(plannedRecipe(YESTERDAY, 'dinner', 'soup'));
    const { earlier } = checkinView(f.deps, TODAY);
    expect(earlier.map(d => d.date)).toEqual([YESTERDAY, TWO_DAYS_AGO]);
    expect(earlier[0].meals[0].recipeSlug).toBe('soup');
  });

  it('asks only before the day’s own meals are done', () => {
    const { f } = household();
    checkedInBefore(f);
    f.deps.plan.upsert(plannedRecipe(YESTERDAY, 'dinner', 'stew'));
    confirmPlannedMeals(f.deps, TODAY);
    expect(checkinView(f.deps, TODAY).earlier).toEqual([]);
  });

  it('answering Yes covers the day’s meals in the pantry questions, once', () => {
    const { f, eggs } = household();
    checkedInBefore(f);
    f.deps.plan.upsert(plannedRecipe(YESTERDAY, 'dinner', 'stew'));
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'stew'));

    confirmPlannedMeals(f.deps, YESTERDAY);
    expect(checkinView(f.deps, TODAY).earlier).toEqual([]);
    confirmPlannedMeals(f.deps, TODAY);

    const view = checkinView(f.deps, TODAY);
    expect(view.carried).toEqual([expect.objectContaining({ date: YESTERDAY, slot: 'dinner' })]);
    expect(view.questions.counts).toEqual([{ pantryItemId: eggs.id, name: 'eggs', estimate: 4, onHand: 12 }]);

    recordPantry(f.deps, TODAY, { ...nothing, counts: [{ pantryItemId: eggs.id, used: 4 }] });
    expect(f.item(eggs.id).count).toBe(8);
    expect(f.entry(YESTERDAY, 'dinner')?.checkinSettled).toBe(true);
    expect(checkinView(f.deps, YESTERDAY).step).toBe('done');
  });

  it('answering No stops asking, and with nothing marked nothing comes off', () => {
    const { f, eggs } = household();
    checkedInBefore(f);
    f.deps.plan.upsert(plannedRecipe(YESTERDAY, 'dinner', 'stew'));

    sayNotAsPlanned(f.deps, YESTERDAY, TODAY);
    expect(checkinView(f.deps, TODAY).earlier).toEqual([]);
    expect(f.entry(YESTERDAY, 'dinner')?.outcome).toBeNull();
    expect(checkinView(f.deps, addDays(TODAY, 1)).earlier).toEqual([]);

    confirmPlannedMeals(f.deps, TODAY);
    const view = checkinView(f.deps, TODAY);
    expect(view.carried).toEqual([]);
    expect(view.questions.counts).toEqual([]);
    recordPantry(f.deps, TODAY, nothing);
    expect(f.item(eggs.id).count).toBe(12);
  });

  it('answering No still lets that day’s rows mark what happened, and what was made comes off', () => {
    const { f, eggs } = household();
    checkedInBefore(f);
    f.deps.plan.upsert(plannedRecipe(YESTERDAY, 'dinner', 'stew'));
    f.deps.plan.upsert(plannedRecipe(YESTERDAY, 'lunch', 'stew'));

    sayNotAsPlanned(f.deps, YESTERDAY, TODAY);
    markMeal(f.deps, YESTERDAY, 'dinner', { outcome: 'made' });
    expect(checkinView(f.deps, TODAY).earlier).toEqual([]);

    confirmPlannedMeals(f.deps, TODAY);
    const view = checkinView(f.deps, TODAY);
    expect(view.carried.map(c => c.slot)).toEqual(['dinner']);
    expect(view.questions.counts).toEqual([{ pantryItemId: eggs.id, name: 'eggs', estimate: 2, onHand: 12 }]);
  });

  it('leaves that day’s own check-in open after No', () => {
    const { f } = household();
    checkedInBefore(f);
    f.deps.plan.upsert(plannedRecipe(YESTERDAY, 'dinner', 'stew'));
    sayNotAsPlanned(f.deps, YESTERDAY, TODAY);
    expect(checkinView(f.deps, YESTERDAY).step).toBe('meals');
  });
});
