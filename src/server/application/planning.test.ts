import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blankEntry, entryKey, withMealDone, type PlanEntry } from '../../domain/plan.ts';
import { writePick } from './claudes-picks.ts';
import { setMealDone } from './meal-updates.ts';
import { planView } from './plan-view.ts';
import { setMeal } from './set-meal.ts';
import { writeUpNote } from './write-up-note.ts';
import { planAhead, replanAfterChange } from './planning.ts';
import { setShopWeekday } from './shop-day.ts';
import { pantryItem, recipe } from '../../domain/test-fixtures.ts';
import { deferred, draft, fakeDeps, planned, type Fakes } from './test-support/full-deps-fake.ts';
import type { PlannedMeal } from './ports/ai.ts';

// A Tuesday, with shopping on Wednesday: only today is held to the pantry.
const TODAY = '2026-11-03';
const TOMORROW = '2026-11-04';
const settle = () => new Promise(resolve => setImmediate(resolve));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-03T12:00:00'));
});
afterEach(() => void vi.useRealTimers());

function holdThePlanner(deps: Fakes, meals: PlannedMeal[]) {
  const held = deferred<PlannedMeal[]>();
  deps.planMeals = () => held.promise;
  return { release: () => held.resolve(meals) };
}

const stockedDeps = () => fakeDeps({
  recipes: [recipe('tacos', ['- 1 lb beef']), recipe('soup', ['- 1 cup broth'], { meals: ['dinner', 'lunch', 'breakfast'] })],
  pantry: [pantryItem(1, 'beef'), pantryItem(2, 'broth')],
});

describe('meals changed while the model is thinking', () => {
  it('keeps a meal pinned during the run', async () => {
    const deps = stockedDeps();
    const planner = holdThePlanner(deps, [planned(TODAY, { recipeSlug: 'tacos' })]);
    const run = planAhead(deps, TODAY, TODAY);
    await setMeal(deps, TODAY, 'dinner', { kind: 'recipe', recipeSlug: 'soup' });
    planner.release();
    await run;
    expect(deps.plan.get(TODAY, 'dinner')).toMatchObject({ recipeSlug: 'soup', pinned: true });
  });

  it('keeps a meal marked done during the run, and pinned', async () => {
    const deps = stockedDeps();
    const eaten: PlanEntry = { ...blankEntry(TODAY, 'dinner'), kind: 'recipe', recipeSlug: 'soup', pinned: true };
    deps.plan.upsert(eaten);
    const planner = holdThePlanner(deps, [planned(TODAY, { recipeSlug: 'tacos' })]);
    const run = planAhead(deps, TODAY, TODAY);
    setMealDone(deps, TODAY, 'dinner', true);
    planner.release();
    await run;
    expect(deps.plan.get(TODAY, 'dinner')).toEqual(withMealDone(eaten, true));
  });

  it('fills the slots that are still open, and counts only those', async () => {
    const deps = stockedDeps();
    const planner = holdThePlanner(deps, [planned(TODAY, { recipeSlug: 'tacos' }), planned(TOMORROW, { recipeSlug: 'tacos' })]);
    const run = planAhead(deps, TOMORROW, TOMORROW);
    await setMeal(deps, TOMORROW, 'dinner', { kind: 'note', note: 'Eating out' });
    planner.release();
    await run;
    expect(deps.plan.get(TOMORROW, 'dinner')?.note).toBe('Eating out');
  });

  it('drops leftovers of a dinner the run lost its slot for', async () => {
    const deps = stockedDeps();
    const planner = holdThePlanner(deps, [
      planned(TODAY, { recipeSlug: 'tacos', multiplier: 2 }),
      planned(TOMORROW, { slot: 'lunch', kind: 'leftovers', leftoversOfDate: TODAY }),
    ]);
    const run = planAhead(deps, TODAY, TOMORROW);
    await setMeal(deps, TODAY, 'dinner', { kind: 'recipe', recipeSlug: 'soup' });
    planner.release();
    await run;
    expect(deps.plan.get(TOMORROW, 'lunch')?.kind).not.toBe('leftovers');
  });

  it('checks the pantry again once the model answers', async () => {
    const pantry = [pantryItem(1, 'beef'), pantryItem(2, 'broth')];
    const deps = fakeDeps({ recipes: [recipe('tacos', ['- 1 lb beef']), recipe('soup', ['- 1 cup broth'])], pantry });
    const planner = holdThePlanner(deps, [planned(TODAY, { recipeSlug: 'tacos' })]);
    const run = planAhead(deps, TODAY, TODAY);
    pantry[0].status = 'out';
    planner.release();
    await run;
    expect(deps.plan.get(TODAY, 'dinner')?.recipeSlug).toBe('soup');
  });

  it('keeps a change made while a note was being written up', async () => {
    const deps = stockedDeps();
    deps.plan.upsert({ ...blankEntry(TODAY, 'dinner'), note: 'Skillet' });
    const writing = deferred<ReturnType<typeof draft>>();
    deps.writeRecipe = () => writing.promise;
    const write = writeUpNote(deps, TODAY, 'dinner');
    setMealDone(deps, TODAY, 'dinner', true);
    writing.resolve(draft('Skillet'));
    await write;
    expect(deps.plan.get(TODAY, 'dinner')).toMatchObject({ kind: 'recipe', recipeSlug: 'skillet', outcome: 'made' });
  });
});

describe('one planning run at a time', () => {
  it('startup and the first tick share one run, and one call to the model', async () => {
    const deps = stockedDeps();
    const planner = holdThePlanner(deps, []);
    const startup = planAhead(deps, TODAY, '2026-11-10');
    const firstTick = planAhead(deps, TODAY, TOMORROW);
    planner.release();
    await Promise.all([startup, firstTick]);
    expect(deps.calls.planMeals).toBe(1);
  });

  it('runs a wider request after the one going, never alongside it', async () => {
    const deps = stockedDeps();
    const planner = holdThePlanner(deps, []);
    const first = planAhead(deps, TODAY, TODAY);
    const second = planAhead(deps, TODAY, TOMORROW);
    await settle();
    expect(deps.calls.planMeals).toBe(1);
    planner.release();
    await Promise.all([first, second]);
    expect(deps.plan.get(TOMORROW, 'dinner')).not.toBeNull();
    expect(deps.calls.planMeals).toBe(2);
  });

  it('folds everything waiting into one run that does it all', async () => {
    const deps = stockedDeps();
    const planner = holdThePlanner(deps, []);
    const first = planAhead(deps, TODAY, TODAY);
    const waiting = [replanAfterChange(deps, TODAY, TOMORROW), replanAfterChange(deps, TODAY, '2026-11-05')];
    planner.release();
    await Promise.all([first, ...waiting]);
    expect(deps.calls.planMeals).toBe(2);
    expect(deps.plan.get('2026-11-05', 'dinner')).not.toBeNull();
  });

  it('a change of shopping day replans after a run that started before it', async () => {
    const deps = fakeDeps({ recipes: [recipe('tacos', ['- 1 lb beef'])], pantry: [pantryItem(1, 'beef', { status: 'out' })] });
    deps.plan.upsert({ ...blankEntry(TOMORROW, 'dinner'), kind: 'recipe', recipeSlug: 'tacos' });
    const planner = holdThePlanner(deps, []);
    const going = planAhead(deps, TODAY, TODAY);
    // Shopping moves from tomorrow to Saturday, so tomorrow's meal now has to come from the house.
    const moved = setShopWeekday(deps, TODAY, 6);
    await settle();
    expect(deps.plan.get(TOMORROW, 'dinner')).not.toBeNull();
    planner.release();
    await Promise.all([going, moved]);
    expect(deps.plan.get(TOMORROW, 'dinner')).toBeNull();
  });

  it('a failed run lets the one waiting go ahead', async () => {
    const deps = stockedDeps();
    const original = deps.recipes.list;
    deps.recipes.list = () => { throw new Error('disk gone'); };
    await expect(planAhead(deps, TODAY, TODAY)).rejects.toThrow('disk gone');
    deps.recipes.list = original;
    await expect(planAhead(deps, TODAY, TODAY)).resolves.toMatchObject({ replaced: 0 });
  });

  it('asks the model only once a run, even with meals to replace', async () => {
    const deps = fakeDeps({ recipes: [recipe('tacos', ['- 1 lb beef']), recipe('soup', ['- 1 cup broth'])], pantry: [pantryItem(1, 'beef', { status: 'out' }), pantryItem(2, 'broth')] });
    deps.plan.upsert({ ...blankEntry(TODAY, 'dinner'), kind: 'recipe', recipeSlug: 'tacos' });
    const { replaced } = await planAhead(deps, TODAY, TOMORROW);
    expect(replaced).toBe(1);
    expect(deps.calls.planMeals).toBe(1);
    expect(deps.plan.get(TODAY, 'dinner')?.recipeSlug).toBe('soup');
  });
});

describe('writing up a dish', () => {
  it('writes the same dish once when asked twice at the same time', async () => {
    const deps = stockedDeps();
    const writing = deferred<ReturnType<typeof draft>>();
    deps.writeRecipe = () => writing.promise;
    const request = { title: 'Sausage skillet', idea: null, slot: 'dinner' as const, fromHouse: false };
    const both = Promise.all([writePick(deps, request), writePick(deps, request)]);
    await settle();
    writing.resolve(draft('Sausage skillet'));
    const [one, two] = await both;
    expect(deps.calls.recipeFromDescription).toBe(1);
    expect(one?.slug).toBe('sausage-skillet');
    expect(two?.slug).toBe('sausage-skillet');
    expect(deps.recipes.get('sausage-skillet-2')).toBeNull();
  });

  it('a second writer still gets its turn if the first was left out', async () => {
    const deps = fakeDeps({ pantry: [] });
    deps.writeRecipe = () => Promise.resolve(draft('Skillet', ['- 1 lb sausage']));
    const picky = writePick(deps, { title: 'Skillet', idea: null, slot: 'dinner', fromHouse: true, onlyIfReady: true });
    const plain = writePick(deps, { title: 'Skillet', idea: null, slot: 'dinner', fromHouse: true });
    expect(await picky).toBeNull();
    expect((await plain)?.slug).toBe('skillet');
    expect(deps.calls.recipeFromDescription).toBe(2);
  });

  it('holds a dish the planner names to the pantry, even when the recipe already exists', async () => {
    const deps = fakeDeps({ recipes: [recipe('tacos', ['- 1 lb beef']), recipe('soup', ['- 1 cup broth'])], pantry: [pantryItem(1, 'beef', { status: 'out' }), pantryItem(2, 'broth')] });
    deps.planMeals = () => Promise.resolve([planned(TODAY, { kind: 'new', note: 'Tacos' })]);
    await planAhead(deps, TODAY, TODAY);
    expect(deps.plan.get(TODAY, 'dinner')?.recipeSlug).toBe('soup');
  });
});

describe('short on something before the groceries come', () => {
  const eggy = () => fakeDeps({
    recipes: [recipe('frittata', ['- 6 eggs'], { meals: ['dinner', 'breakfast', 'lunch'] }), recipe('soup', ['- 1 cup broth'], { meals: ['dinner', 'breakfast', 'lunch'] })],
    pantry: [pantryItem(1, 'eggs', { count: 3 }), pantryItem(2, 'broth')],
  });

  it('rejects a model pick there is not enough for', async () => {
    const deps = eggy();
    deps.planMeals = () => Promise.resolve([planned(TODAY, { recipeSlug: 'frittata' })]);
    await planAhead(deps, TODAY, TODAY);
    expect(deps.plan.get(TODAY, 'dinner')?.recipeSlug).toBe('soup');
  });

  it('replaces a planned meal once the pantry falls short', async () => {
    const deps = eggy();
    deps.plan.upsert({ ...blankEntry(TODAY, 'dinner'), kind: 'recipe', recipeSlug: 'frittata' });
    await planAhead(deps, TODAY, null);
    expect(deps.plan.get(TODAY, 'dinner')?.recipeSlug).toBe('soup');
  });

  it('leaves a short meal alone after the groceries come', async () => {
    const deps = eggy();
    deps.planMeals = () => Promise.resolve([planned(TOMORROW, { recipeSlug: 'frittata' })]);
    await planAhead(deps, TOMORROW, TOMORROW);
    expect(deps.plan.get(TOMORROW, 'dinner')?.recipeSlug).toBe('frittata');
  });

  it('tells the model how ready a recipe is at the size it would plan', async () => {
    const deps = fakeDeps({ recipes: [recipe('frittata', ['- 3 eggs'], { serves: 2 })], pantry: [pantryItem(1, 'eggs', { count: 3 })] });
    let told = '';
    deps.planMeals = context => {
      told = context.recipes[0].availability;
      return Promise.resolve([]);
    };
    await planAhead(deps, TODAY, TODAY);
    expect(told).toBe('missing');
  });
});

describe('leftovers', () => {
  const leftoversOf = (date: string, sourceDate: string, extra: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(date, 'lunch'), kind: 'leftovers', leftoversOf: { date: sourceDate, slot: 'dinner' }, ...extra });
  const dinner = (date: string, slug: string, extra: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(date, 'dinner'), kind: 'recipe', recipeSlug: slug, ...extra });
  const outOfBeef = () => fakeDeps({ ai: false, recipes: [recipe('tacos', ['- 1 lb beef'], { meals: ['dinner'] })], pantry: [pantryItem(1, 'beef', { status: 'out' })] });

  it('come off with the dinner they point at', async () => {
    const deps = outOfBeef();
    deps.plan.upsert(dinner(TODAY, 'tacos'));
    deps.plan.upsert(leftoversOf(TOMORROW, TODAY));
    await planAhead(deps, TODAY, null);
    expect(deps.plan.get(TODAY, 'dinner')).toBeNull();
    expect(deps.plan.get(TOMORROW, 'lunch')).toBeNull();
  });

  it('stay if someone chose them, or they were eaten', async () => {
    const deps = outOfBeef();
    deps.plan.upsert(dinner(TODAY, 'tacos'));
    deps.plan.upsert(leftoversOf(TOMORROW, TODAY, { pinned: true }));
    await planAhead(deps, TODAY, null);
    expect(deps.plan.get(TOMORROW, 'lunch')).not.toBeNull();
  });

  it('from the model must be of a dinner that really gets cooked', async () => {
    const deps = stockedDeps();
    const lunch = (date: string, leftoversOfDate: string) => planned(date, { slot: 'lunch', kind: 'leftovers', leftoversOfDate });
    deps.plan.upsert({ ...blankEntry('2026-11-02', 'dinner'), kind: 'recipe', recipeSlug: 'soup', outcome: 'skipped' });
    deps.planMeals = () => Promise.resolve([
      planned(TODAY, { recipeSlug: 'tacos' }),
      lunch(TODAY, '2026-11-02'), // that dinner was skipped
      lunch(TOMORROW, TODAY), // fine
      lunch('2026-11-05', '2026-12-25'), // nothing there, and in the future
      lunch('2026-11-06', 'not a date'),
    ]);
    await planAhead(deps, TODAY, '2026-11-06');
    const kinds = (date: string) => deps.entries.get(entryKey({ date, slot: 'lunch' }))?.kind;
    expect(kinds(TODAY)).not.toBe('leftovers');
    expect(kinds(TOMORROW)).toBe('leftovers');
    expect(kinds('2026-11-05')).not.toBe('leftovers');
    expect(kinds('2026-11-06')).not.toBe('leftovers');
  });
});

describe('pinned leftovers whose dinner changes', () => {
  const source = (extra: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(TODAY, 'dinner'), kind: 'recipe', recipeSlug: 'tacos', ...extra });
  const leftovers = (extra: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(TOMORROW, 'lunch'), kind: 'leftovers', leftoversOf: { date: TODAY, slot: 'dinner' }, ...extra });

  it('stay with no source when the dinner comes off for not fitting', async () => {
    const deps = fakeDeps({ recipes: [recipe('tacos', ['- 1 lb beef']), recipe('soup', ['- 1 cup broth'])], pantry: [pantryItem(1, 'beef', { status: 'out' }), pantryItem(2, 'broth')] });
    deps.plan.upsert(source());
    deps.plan.upsert(leftovers({ pinned: true }));
    await planAhead(deps, TODAY, null);
    expect(deps.plan.get(TOMORROW, 'lunch')).toMatchObject({ kind: 'leftovers', pinned: true, leftoversOf: null });
    expect(planView(deps, TOMORROW, TOMORROW).find(e => e.slot === 'lunch')?.leftoversTitle).toBeNull();
  });

  it('stay with no source when someone chooses a different dinner', async () => {
    const deps = stockedDeps();
    deps.plan.upsert(source());
    deps.plan.upsert(leftovers({ pinned: true }));
    await setMeal(deps, TODAY, 'dinner', { kind: 'recipe', recipeSlug: 'soup' });
    expect(deps.plan.get(TOMORROW, 'lunch')).toMatchObject({ kind: 'leftovers', pinned: true, leftoversOf: null });
    expect(planView(deps, TOMORROW, TOMORROW).find(e => e.slot === 'lunch')?.leftoversTitle).toBeNull();
  });

  it('keep their source when the dinner is the same dish at another size', async () => {
    const deps = stockedDeps();
    deps.plan.upsert(source());
    deps.plan.upsert(leftovers({ pinned: true }));
    await setMeal(deps, TODAY, 'dinner', { kind: 'recipe', recipeSlug: 'tacos', multiplier: 2 });
    expect(planView(deps, TOMORROW, TOMORROW).find(e => e.slot === 'lunch')?.leftoversTitle).toBe('tacos');
  });

  it('don’t lose an outcome, or a source already eaten', async () => {
    const deps = stockedDeps();
    deps.plan.upsert(source());
    deps.plan.upsert(leftovers({ pinned: true, outcome: 'made' }));
    await setMeal(deps, TODAY, 'dinner', { kind: 'recipe', recipeSlug: 'soup' });
    expect(deps.plan.get(TOMORROW, 'lunch')?.leftoversOf).toEqual({ date: TODAY, slot: 'dinner' });
  });
});

describe('meals before the groceries, held to one pantry', () => {
  // Shopping on Saturday: everything through Friday draws on what's in the house.
  const eggRecipes = () => [recipe('frittata', ['- 4 eggs']), recipe('omelet', ['- 4 eggs'])];
  const dinners = (deps: Fakes, ...dates: string[]) => dates.map(date => deps.plan.get(date, 'dinner')?.recipeSlug ?? null);

  it('won’t put two meals on that together need more eggs than there are', async () => {
    const deps = fakeDeps({ ai: false, recipes: eggRecipes(), pantry: [pantryItem(1, 'eggs', { count: 6 })], shopWeekday: 6 });
    await planAhead(deps, TODAY, TOMORROW);
    expect(dinners(deps, TODAY, TOMORROW).filter(Boolean)).toHaveLength(1);
  });

  it('holds what the model chose to it too, earliest first', async () => {
    const deps = fakeDeps({ recipes: eggRecipes(), pantry: [pantryItem(1, 'eggs', { count: 6 })], shopWeekday: 6 });
    deps.planMeals = () => Promise.resolve([planned(TOMORROW, { recipeSlug: 'omelet' }), planned(TODAY, { recipeSlug: 'frittata' })]);
    await planAhead(deps, TODAY, TOMORROW);
    expect(dinners(deps, TODAY, TOMORROW)).toEqual(['frittata', null]);
  });

  it('counts what’s already on the plan', async () => {
    const deps = fakeDeps({ ai: false, recipes: eggRecipes(), pantry: [pantryItem(1, 'eggs', { count: 6 })], shopWeekday: 6 });
    deps.plan.upsert({ ...blankEntry(TODAY, 'dinner'), kind: 'recipe', recipeSlug: 'frittata', pinned: true });
    await planAhead(deps, TODAY, TOMORROW);
    expect(dinners(deps, TOMORROW)).toEqual([null]);
  });

  it('plans both when there are enough', async () => {
    const deps = fakeDeps({ ai: false, recipes: eggRecipes(), pantry: [pantryItem(1, 'eggs', { count: 8 })], shopWeekday: 6 });
    await planAhead(deps, TODAY, TOMORROW);
    expect(dinners(deps, TODAY, TOMORROW).filter(Boolean)).toHaveLength(2);
  });

  it('doesn’t hold days from the trip on to it', async () => {
    const deps = fakeDeps({ ai: false, recipes: eggRecipes(), pantry: [pantryItem(1, 'eggs', { count: 6 })] }); // shopping tomorrow
    await planAhead(deps, TODAY, TOMORROW);
    expect(dinners(deps, TODAY, TOMORROW).filter(Boolean)).toHaveLength(2);
  });

  it('leaves meals already planned alone, even if together they’re over', async () => {
    const deps = fakeDeps({ ai: false, recipes: eggRecipes(), pantry: [pantryItem(1, 'eggs', { count: 6 })], shopWeekday: 6 });
    deps.plan.upsert({ ...blankEntry(TODAY, 'dinner'), kind: 'recipe', recipeSlug: 'frittata' });
    deps.plan.upsert({ ...blankEntry(TOMORROW, 'dinner'), kind: 'recipe', recipeSlug: 'omelet' });
    await planAhead(deps, TODAY, null);
    expect(dinners(deps, TODAY, TOMORROW)).toEqual(['frittata', 'omelet']);
  });
});
