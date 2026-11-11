import { describe, expect, it } from 'vitest';
import { blankEntry, type PlanEntry } from '../../domain/plan.ts';
import { recipe } from '../../domain/test-fixtures.ts';
import { recordMeal } from './checkin.ts';
import { finishCooking } from './test-support/cook-meal.ts';
import { setMealDone } from './meal-updates.ts';
import { planView } from './plan-view.ts';
import { placeChoice, setMeal } from './set-meal.ts';
import { plannedRecipe, TODAY, transactionalFakes } from './test-support/transactional-fakes.ts';

const TOMORROW = '2026-11-05';
const FRIDAY = '2026-11-06';
const YESTERDAY = '2026-11-03';
const source = { date: TODAY, slot: 'dinner' as const };
const lunch = (date: string, over: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(date, 'lunch'), kind: 'leftovers', leftoversOf: source, ...over });
const said = (outcome: 'made' | 'skipped' | 'swapped', over = {}) => ({ date: TODAY, slot: 'dinner' as const, outcome, recipeSlug: null, note: null, ...over });

function dinnerWithLeftovers() {
  const f = transactionalFakes([recipe('tacos', ['1 lb beef']), recipe('soup', ['1 cup broth'])]);
  f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'tacos'));
  f.deps.plan.upsert(lunch(TOMORROW));
  f.deps.plan.upsert(lunch(FRIDAY, { pinned: true }));
  return f;
}

describe('leftovers when the dinner didn’t happen', () => {
  it('come off when it’s skipped, and pinned ones stay plain', () => {
    const f = dinnerWithLeftovers();
    recordMeal(f.deps, said('skipped'));
    expect(f.entry(TOMORROW, 'lunch')).toBeNull();
    expect(f.entry(FRIDAY, 'lunch')).toMatchObject({ kind: 'leftovers', leftoversOf: null, pinned: true });
  });

  it('come off when it’s swapped for another recipe or a name', () => {
    for (const change of [{ recipeSlug: 'soup' }, { note: 'Takeout' }]) {
      const f = dinnerWithLeftovers();
      recordMeal(f.deps, said('swapped', change));
      expect(f.entry(TOMORROW, 'lunch')).toBeNull();
      expect(f.entry(FRIDAY, 'lunch')?.leftoversOf).toBeNull();
    }
  });

  it('stay when it’s made, or swapped to what was planned', () => {
    const f = dinnerWithLeftovers();
    recordMeal(f.deps, said('made'));
    recordMeal(f.deps, said('swapped', { recipeSlug: 'tacos' }));
    expect(f.entry(TOMORROW, 'lunch')?.leftoversOf).toEqual(source);
  });

  it('stay when the same swap is said twice, once someone has chosen them', () => {
    const f = dinnerWithLeftovers();
    recordMeal(f.deps, said('swapped', { recipeSlug: 'soup' }));
    f.deps.plan.upsert(lunch(TOMORROW, { pinned: true }));
    recordMeal(f.deps, said('swapped', { recipeSlug: 'soup' }));
    expect(f.entry(TOMORROW, 'lunch')?.leftoversOf).toEqual(source);
  });

  it('come off for a dinner that was only a name, too', () => {
    const f = transactionalFakes();
    f.deps.plan.upsert({ ...blankEntry(TODAY, 'dinner'), note: 'Burgers' });
    f.deps.plan.upsert(lunch(TOMORROW));
    recordMeal(f.deps, said('skipped'));
    expect(f.entry(TOMORROW, 'lunch')).toBeNull();
  });

  it('leave ones already eaten alone', () => {
    const f = dinnerWithLeftovers();
    f.deps.plan.upsert(lunch(TOMORROW, { outcome: 'made' }));
    recordMeal(f.deps, said('skipped'));
    expect(f.entry(TOMORROW, 'lunch')?.leftoversOf).toEqual(source);
  });

  it('stay when cook mode already saved the dinner, because the skip changes nothing', () => {
    const f = dinnerWithLeftovers();
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'tacos', { outcome: 'made', pantrySettled: true }));
    recordMeal(f.deps, said('skipped'));
    expect(f.entry(TOMORROW, 'lunch')?.leftoversOf).toEqual(source);
  });

  it('come off when cook mode made a different dish', () => {
    const f = dinnerWithLeftovers();
    finishCooking(f.deps, { slug: 'soup', factor: 1, today: TODAY, hour: 18, date: TODAY, slot: 'dinner' });
    expect(f.entry(TOMORROW, 'lunch')).toBeNull();
    expect(f.entry(FRIDAY, 'lunch')?.leftoversOf).toBeNull();
  });

  it('stay when cook mode made the planned dish', () => {
    const f = dinnerWithLeftovers();
    finishCooking(f.deps, { slug: 'tacos', factor: 1, today: TODAY, hour: 18, date: TODAY, slot: 'dinner' });
    expect(f.entry(TOMORROW, 'lunch')?.leftoversOf).toEqual(source);
  });
});

describe('leftovers when the dinner is swapped on the plan', () => {
  it('come off, and pinned ones stay plain', async () => {
    const f = dinnerWithLeftovers();
    await setMeal(f.deps, TODAY, 'dinner', { kind: 'note', note: 'Eating out' });
    expect(f.entry(TOMORROW, 'lunch')).toBeNull();
    expect(f.entry(FRIDAY, 'lunch')).toMatchObject({ leftoversOf: null, pinned: true });
  });

  it('come off when a name becomes another name', async () => {
    const f = transactionalFakes();
    f.deps.plan.upsert({ ...blankEntry(TODAY, 'dinner'), note: 'Burgers' });
    f.deps.plan.upsert(lunch(TOMORROW));
    await setMeal(f.deps, TODAY, 'dinner', { kind: 'note', note: 'Pizza' });
    expect(f.entry(TOMORROW, 'lunch')).toBeNull();
  });

  it('stay when it’s the same dish at another size', async () => {
    const f = dinnerWithLeftovers();
    await setMeal(f.deps, TODAY, 'dinner', { kind: 'recipe', recipeSlug: 'tacos', multiplier: 2 });
    expect(f.entry(TOMORROW, 'lunch')?.leftoversOf).toEqual(source);
  });
});

describe('marking the dinner made again later', () => {
  it('brings no leftovers back, and doesn’t touch what filled the slot', () => {
    const f = dinnerWithLeftovers();
    recordMeal(f.deps, said('skipped'));
    f.deps.plan.upsert(plannedRecipe(TOMORROW, 'lunch', 'soup'));
    recordMeal(f.deps, said('made'));
    setMealDone(f.deps, TODAY, 'dinner', true);
    expect(f.entry(TOMORROW, 'lunch')).toMatchObject({ kind: 'recipe', recipeSlug: 'soup', leftoversOf: null });
    expect(f.entry(FRIDAY, 'lunch')?.leftoversOf).toBeNull();
    expect(planView(f.deps, FRIDAY, FRIDAY)[0].leftoversTitle).toBeNull();
  });

  it('names the planned dish, not the note from a swap it took back', () => {
    const f = dinnerWithLeftovers();
    recordMeal(f.deps, said('swapped', { note: 'Red beans' }));
    recordMeal(f.deps, said('made'));
    expect(planView(f.deps, TODAY, TODAY)[0].madeTitle).toBe(f.deps.recipes.get('tacos')!.title);
  });

  it('goes back to the planned dish’s own size, not the swap’s', () => {
    const f = transactionalFakes([recipe('tacos', ['1 lb beef']), { ...recipe('soup', ['1 cup broth']), serves: 1 }]);
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'tacos'));
    recordMeal(f.deps, said('swapped', { recipeSlug: 'soup' }));
    const swapSize = f.entry(TODAY, 'dinner')!.multiplier;
    expect(swapSize).toBeGreaterThan(1);
    recordMeal(f.deps, said('made'));
    expect(f.entry(TODAY, 'dinner')).toMatchObject({ outcome: 'made', outcomeSlug: null, multiplier: 1 });
  });

  it('goes back to its own size when a swap is unticked', () => {
    const f = transactionalFakes([recipe('tacos', ['1 lb beef']), { ...recipe('soup', ['1 cup broth']), serves: 1 }]);
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'tacos'));
    recordMeal(f.deps, said('swapped', { recipeSlug: 'soup' }));
    setMealDone(f.deps, TODAY, 'dinner', false);
    expect(f.entry(TODAY, 'dinner')).toMatchObject({ outcome: null, multiplier: 1 });
  });
});

describe('choosing leftovers', () => {
  const chosen = { kind: 'leftovers' as const, leftoversOf: { date: YESTERDAY, slot: 'dinner' as const } };

  it('takes a dinner that was made, even one that was only a name', () => {
    const f = transactionalFakes();
    f.deps.plan.upsert({ ...blankEntry(YESTERDAY, 'dinner'), note: 'Burgers', outcome: 'made' });
    placeChoice(f.deps, TODAY, 'dinner', chosen);
    expect(f.entry(TODAY, 'dinner')?.leftoversOf).toEqual(chosen.leftoversOf);
    expect(planView(f.deps, TODAY, TODAY)[0].leftoversTitle).toBe('Burgers');
  });

  it('refuses one that was skipped, planned, or not there', () => {
    const f = transactionalFakes([recipe('tacos', ['1 lb beef'])]);
    expect(() => placeChoice(f.deps, TODAY, 'dinner', chosen)).toThrow(/wasn’t made/);
    f.deps.plan.upsert(plannedRecipe(YESTERDAY, 'dinner', 'tacos'));
    expect(() => placeChoice(f.deps, TODAY, 'dinner', chosen)).toThrow(/wasn’t made/);
    f.deps.plan.upsert(plannedRecipe(YESTERDAY, 'dinner', 'tacos', { outcome: 'skipped' }));
    expect(() => placeChoice(f.deps, TODAY, 'dinner', chosen)).toThrow(/wasn’t made/);
  });

  it('still takes plain leftovers from nowhere in particular', () => {
    const f = transactionalFakes();
    placeChoice(f.deps, TODAY, 'dinner', { kind: 'leftovers', leftoversOf: null });
    expect(f.entry(TODAY, 'dinner')).toMatchObject({ kind: 'leftovers', pinned: true });
  });
});
