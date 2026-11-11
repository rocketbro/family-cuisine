// Claude's ideas off: planning for this import only uses the book. On, nothing changes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pantryItem, recipe } from '../../domain/test-fixtures.ts';
import { blankEntry, entryKey } from '../../domain/plan.ts';
import { confirmPlanImport, fillAfterPlanImport, planImportView, startPlanImport } from './plan-import.ts';
import { planAhead, planToHorizon } from './planning.ts';
import type { PlannedMeal, SaidPlanMeal } from './ports/ai.ts';
import { deferred, fakeDeps, planned, type Fakes } from './test-support/full-deps-fake.ts';

// A Friday.
const TODAY = '2026-11-06';
const settle = () => new Promise(resolve => setImmediate(resolve));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-06T12:00:00'));
});
afterEach(() => void vi.useRealTimers());

const said = (over: Partial<SaidPlanMeal>): SaidPlanMeal => ({
  said: 'stew', weekday: 'Monday', date: null, slot: 'dinner', kind: 'recipe', recipeSlug: 'pick', name: 'Stew', confidence: 'sure', ...over,
});

const everyMeal = { meals: ['breakfast', 'lunch', 'dinner'] as const };

function book(): Fakes {
  return fakeDeps({
    recipes: [
      recipe('soup', ['- 1 cup broth'], { ...everyMeal, meals: [...everyMeal.meals] }),
      recipe('kept', ['- 1 cup broth'], { meals: [...everyMeal.meals], claudesPick: false }),
      recipe('pick', ['- 1 cup broth'], { meals: [...everyMeal.meals], claudesPick: true }),
    ],
    pantry: [pantryItem(1, 'broth')],
  });
}

async function readWith(deps: Fakes, meals: SaidPlanMeal[], claudesIdeas: boolean) {
  const contexts: Parameters<Fakes['ai']['readMealPlan']>[1][] = [];
  deps.ai.readMealPlan = (_plan, context) => { contexts.push(context); return Promise.resolve(meals); };
  const id = startPlanImport(deps, { text: 'stew Mon', photos: [], from: '2026-11-09', through: '2026-11-15', claudesIdeas }, TODAY);
  await settle();
  return { id, offered: contexts[0].recipes.map(r => r.slug) };
}

const slugsOnPlan = (deps: Fakes, from: string, through: string) => deps.plan.range(from, through).map(e => e.recipeSlug);

describe('matching a plan against the recipes', () => {
  it('with ideas on, a pick is a recipe like any other, as it is today', async () => {
    const deps = book();
    const { offered } = await readWith(deps, [said({})], true);
    expect(offered).toEqual(['soup', 'kept', 'pick']);
    expect(planImportView(deps)).toMatchObject({ claudesIdeas: true, meals: [{ match: { kind: 'recipe', slug: 'pick' } }] });
  });

  it('with ideas off, doesn’t offer an unkept pick, but does offer a kept one', async () => {
    const { offered } = await readWith(book(), [said({})], false);
    expect(offered).toEqual(['soup', 'kept']);
  });

  it('with ideas off, turns a match on an unkept pick back into a name, marked unsure', async () => {
    const deps = book();
    await readWith(deps, [said({}), said({ recipeSlug: 'kept', slot: 'lunch' })], false);
    expect(planImportView(deps)).toMatchObject({
      claudesIdeas: false,
      meals: [{ match: { kind: 'named', name: 'Stew' }, confidence: 'unsure' }, { match: { kind: 'recipe', slug: 'kept' } }],
    });
  });
});

describe('saving with ideas off', () => {
  const pick = { kind: 'recipe', slug: 'pick', title: 'Pick' } as const;

  it('refuses an unkept pick, whatever the phone sent, and saves none of it', async () => {
    const deps = book();
    const { id } = await readWith(deps, [said({ kind: 'named', recipeSlug: null })], false);
    expect(() => confirmPlanImport(deps, id, [{ date: '2026-11-09', slot: 'lunch', match: { kind: 'named', name: 'x' } }, { date: '2026-11-09', slot: 'dinner', match: pick }], TODAY)).toThrow(/Claude’s ideas/);
    expect(planImportView(deps).status).toBe('ready');
  });

  it('takes a kept pick', async () => {
    const deps = book();
    const { id } = await readWith(deps, [said({ kind: 'named', recipeSlug: null })], false);
    confirmPlanImport(deps, id, [{ date: '2026-11-09', slot: 'dinner', match: { kind: 'recipe', slug: 'kept', title: 'Kept' } }], TODAY);
    expect(deps.plan.get('2026-11-09', 'dinner')?.recipeSlug).toBe('kept');
  });

  it('with ideas on, takes an unkept pick', async () => {
    const deps = book();
    const { id } = await readWith(deps, [said({})], true);
    confirmPlanImport(deps, id, [{ date: '2026-11-09', slot: 'dinner', match: pick }], TODAY);
    expect(deps.plan.get('2026-11-09', 'dinner')?.recipeSlug).toBe('pick');
  });
});

describe('filling in the rest', () => {
  async function saved(deps: Fakes, claudesIdeas: boolean) {
    const { id } = await readWith(deps, [said({ kind: 'named', recipeSlug: null })], claudesIdeas);
    confirmPlanImport(deps, id, [], TODAY);
  }
  const answer = (date: string, over: Partial<PlannedMeal>[]): PlannedMeal[] => over.map((meal, i) => planned(date, { slot: (['breakfast', 'lunch', 'dinner'] as const)[i], ...meal }));

  it('with ideas off, lets through no new dish, unkept pick or named meal, and writes no recipe', async () => {
    const deps = book();
    await saved(deps, false);
    const seen: Parameters<Fakes['planMeals']>[0][] = [];
    deps.planMeals = context => {
      seen.push(context);
      return Promise.resolve(answer(TODAY, [{ kind: 'new', note: 'Invented skillet' }, { kind: 'recipe', recipeSlug: 'pick' }, { kind: 'note', note: 'Made-up stew' }]));
    };
    await fillAfterPlanImport(deps, TODAY);
    expect(deps.calls.recipeFromDescription).toBe(0);
    expect(deps.recipes.list()).toHaveLength(3);
    expect(seen[0].onlyFromTheBook).toBe(true);
    expect(seen[0].recipes.map(r => r.slug)).toEqual(['soup', 'kept']);
    const entries = deps.plan.range(TODAY, TODAY);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every(e => e.kind === 'recipe' && e.recipeSlug !== 'pick')).toBe(true);
  });

  it('with ideas off, uses a recipe from the book and a kept pick when the model chooses them', async () => {
    const deps = book();
    await saved(deps, false);
    deps.planMeals = () => Promise.resolve(answer(TODAY, [{ kind: 'recipe', recipeSlug: 'soup' }, { kind: 'recipe', recipeSlug: 'kept' }]));
    await fillAfterPlanImport(deps, TODAY);
    expect(deps.plan.get(TODAY, 'breakfast')?.recipeSlug).toBe('soup');
    expect(deps.plan.get(TODAY, 'lunch')?.recipeSlug).toBe('kept');
  });

  it('with ideas off and nothing in the book, doesn’t even ask the model', async () => {
    const deps = fakeDeps({ recipes: [recipe('pick', ['- 1 cup broth'], { claudesPick: true })] });
    await saved(deps, false);
    expect(await fillAfterPlanImport(deps, TODAY)).toBe(0);
    expect(deps.calls.planMeals).toBe(0);
  });

  it('with ideas on, new dishes still come through as they do today', async () => {
    const deps = book();
    await saved(deps, true);
    deps.planMeals = context => {
      expect(context.onlyFromTheBook).toBeUndefined();
      expect(context.recipes.map(r => r.slug)).toContain('pick');
      return Promise.resolve(answer(TODAY, [{ kind: 'new', note: 'Invented skillet' }]));
    };
    await fillAfterPlanImport(deps, TODAY);
    expect(deps.calls.recipeFromDescription).toBe(1);
  });

  it('won’t share a run that can still invent dishes', async () => {
    const deps = book();
    await saved(deps, false);
    const held = deferred<PlannedMeal[]>();
    deps.planMeals = () => held.promise;
    const open = planAhead(deps, TODAY, TODAY);
    await settle();
    const fill = fillAfterPlanImport(deps, TODAY);
    held.resolve(answer(TODAY, [{ kind: 'new', note: 'Invented skillet' }]));
    await open;
    deps.planMeals = () => Promise.resolve(answer('2026-11-07', [{ kind: 'new', note: 'Another one' }]));
    const callsAfterOpen = deps.calls.recipeFromDescription;
    await fill;
    expect(deps.calls.planMeals).toBe(2);
    expect(deps.calls.recipeFromDescription).toBe(callsAfterOpen);
  });

  it('leaves the rest of the app’s planning alone', async () => {
    const deps = book();
    deps.planMeals = context => {
      expect(context.onlyFromTheBook).toBeUndefined();
      return Promise.resolve(answer(TODAY, [{ kind: 'recipe', recipeSlug: 'pick' }]));
    };
    await planToHorizon(deps, TODAY);
    expect(slugsOnPlan(deps, TODAY, TODAY)).toContain('pick');
  });

  it('never touches what’s planned already', async () => {
    const deps = book();
    await saved(deps, false);
    deps.plan.upsert({ ...blankEntry(TODAY, 'dinner'), kind: 'note', note: 'Our pizza', pinned: true });
    await fillAfterPlanImport(deps, TODAY);
    const dinner = deps.plan.range(TODAY, TODAY).find(e => entryKey(e) === entryKey({ date: TODAY, slot: 'dinner' }));
    expect(dinner?.note).toBe('Our pizza');
  });
});
