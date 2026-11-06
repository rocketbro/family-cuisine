import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportPlacement } from '../../domain/plan-import.ts';
import { extrasOnly } from '../../domain/plan-slot.ts';
import { blankEntry } from '../../domain/plan.ts';
import { pantryItem, recipe } from '../../domain/test-fixtures.ts';
import type { Deps } from './deps.ts';
import { keepPlanCookable } from './keep-plan-cookable.ts';
import { confirmPlanImport, discardPlanImport, planImportView, retryPlanImport, startPlanImport } from './plan-import.ts';
import { planAhead } from './planning.ts';
import type { SaidPlanMeal } from './ports/ai.ts';
import { deferred, fakeDeps } from './test-support/full-deps-fake.ts';
import { transactionalFakes } from './test-support/transactional-fakes.ts';

// A Friday.
const TODAY = '2026-11-06';
const settle = () => new Promise(resolve => setImmediate(resolve));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-06T12:00:00'));
});
afterEach(() => void vi.useRealTimers());

const said = (over: Partial<SaidPlanMeal>): SaidPlanMeal => ({
  said: 'tacos', weekday: 'Tuesday', date: null, slot: 'dinner', kind: 'named', recipeSlug: null, name: 'Tacos', confidence: 'sure', ...over,
});

const book = [recipe('chicken-tacos', ['1 lb chicken'], { title: 'Chicken tacos' }), recipe('cake', ['2 eggs'], { title: 'Cake', meals: [] }), recipe('toast', ['1 slice bread'], { meals: ['breakfast'] }), recipe('soup', ['1 can broth'], { meals: ['lunch'] })];

function setUp(meals: SaidPlanMeal[], opts: { ai?: boolean } = {}) {
  const deps = fakeDeps({ recipes: book, pantry: [pantryItem(1, 'bread'), pantryItem(2, 'broth'), pantryItem(3, 'chicken')], ai: opts.ai ?? true });
  const calls: Parameters<typeof deps.ai.readMealPlan>[] = [];
  deps.ai.readMealPlan = (plan, context) => {
    calls.push([plan, context]);
    return Promise.resolve(meals);
  };
  deps.photos = { forModel: data => Promise.resolve({ mediaType: 'image/jpeg', data: data.toString('base64') }) } as Deps['photos'];
  return { deps, calls };
}

async function read(deps: Deps, text = 'tacos Tues') {
  startPlanImport(deps, { text, photos: [] }, TODAY);
  await settle();
  const view = planImportView(deps);
  if (view.status !== 'ready') throw new Error(`not ready: ${JSON.stringify(view)}`);
  return view;
}

const place = (date: string, slot: ImportPlacement['slot'], match: ImportPlacement['match']): ImportPlacement => ({ date, slot, match });
const NAMED = { kind: 'named', name: 'Tacos' } as const;

describe('reading a plan', () => {
  it('says so plainly with no key, and starts nothing', () => {
    const { deps } = setUp([], { ai: false });
    expect(() => startPlanImport(deps, { text: 'tacos', photos: [] }, TODAY)).toThrow(/Anthropic API key/);
    expect(planImportView(deps)).toEqual({ status: 'none' });
  });

  it('wants a photo or words', () => {
    const { deps } = setUp([]);
    expect(() => startPlanImport(deps, { text: '   ', photos: [] }, TODAY)).toThrow(/photo/);
  });

  it('answers while it reads, and holds the words and photos apart', async () => {
    const { deps, calls } = setUp([said({})]);
    const held = deferred<SaidPlanMeal[]>();
    deps.ai.readMealPlan = (plan, context) => { calls.push([plan, context]); return held.promise; };
    startPlanImport(deps, { text: ' Tues tacos ', photos: [Buffer.from('jpg')] }, TODAY);
    expect(planImportView(deps).status).toBe('reading');
    await settle();
    expect(calls[0][0]).toEqual({ text: 'Tues tacos', images: [{ mediaType: 'image/jpeg', data: Buffer.from('jpg').toString('base64') }] });
    expect(calls[0][1].today).toBe(TODAY);
    held.resolve([said({})]);
    await settle();
    expect(planImportView(deps).status).toBe('ready');
  });

  it('assumes the week from the first day the plan names', async () => {
    const { deps } = setUp([said({ weekday: 'Monday' }), said({ weekday: 'Friday', slot: 'lunch' })]);
    expect((await read(deps)).weekStart).toBe('2026-11-09');
  });

  it('keeps only real recipes; a slug the book doesn’t have stays a name, marked unsure', async () => {
    const { deps } = setUp([
      said({ kind: 'recipe', recipeSlug: 'chicken-tacos', confidence: 'likely' }),
      said({ kind: 'recipe', recipeSlug: 'invented', name: null, said: 'lasagna', slot: 'lunch' }),
    ]);
    const { meals } = await read(deps);
    expect(meals[0]).toMatchObject({ match: { kind: 'recipe', slug: 'chicken-tacos', title: 'Chicken tacos' }, confidence: 'likely' });
    expect(meals[1]).toMatchObject({ match: { kind: 'named', name: 'lasagna' }, confidence: 'unsure' });
  });

  it('writes no recipes', async () => {
    const { deps } = setUp([said({})]);
    const before = deps.recipes.list().length;
    await read(deps);
    expect(deps.recipes.list()).toHaveLength(before);
    expect(deps.calls.recipeFromDescription).toBe(0);
  });

  it('keeps a date only if it exists', async () => {
    const { deps } = setUp([said({ date: '2026-02-30', weekday: null }), said({ date: '2026-11-20', weekday: null, slot: 'lunch' })]);
    const { meals } = await read(deps);
    expect(meals.map(m => m.date)).toEqual([null, '2026-11-20']);
  });

  it('leftovers can’t be an extra', async () => {
    const { deps } = setUp([said({ kind: 'leftovers', slot: 'extra', name: null })]);
    expect((await read(deps)).meals[0]).toMatchObject({ slot: 'lunch', match: { kind: 'leftovers' } });
  });

  it('holds what the plan says to plain text and a sane size', async () => {
    const { deps } = setUp([said({ name: 'x'.repeat(500), said: 'y'.repeat(500) })]);
    const { meals } = await read(deps);
    expect(meals[0].said).toHaveLength(120);
    expect(meals[0].match).toEqual({ kind: 'named', name: 'x'.repeat(120) });
  });

  it('fails plainly when there’s nothing in it, without losing the words', async () => {
    const { deps } = setUp([]);
    startPlanImport(deps, { text: 'hello', photos: [] }, TODAY);
    await settle();
    expect(planImportView(deps)).toMatchObject({ status: 'failed', canRetry: true, error: expect.stringMatching(/any meals/) });
  });

  it('gives a plain message for a model error, and reads the words again on retry', async () => {
    const { deps } = setUp([said({})]);
    const works = deps.ai.readMealPlan;
    deps.ai.readMealPlan = () => Promise.reject(new Error('secret upstream detail'));
    startPlanImport(deps, { text: 'tacos', photos: [] }, TODAY);
    await settle();
    const failed = planImportView(deps);
    expect(failed).toMatchObject({ status: 'failed', error: 'Couldn’t read that plan.' });
    deps.ai.readMealPlan = works;
    retryPlanImport(deps, TODAY);
    await settle();
    expect(planImportView(deps).status).toBe('ready');
  });

  it('won’t read again with the key gone', async () => {
    const { deps } = setUp([]);
    startPlanImport(deps, { text: 'tacos', photos: [] }, TODAY);
    await settle();
    deps.ai.available = () => false;
    expect(() => retryPlanImport(deps, TODAY)).toThrow(/Anthropic API key/);
  });

  it('asks for a photo again, since photos aren’t kept', async () => {
    const { deps } = setUp([]);
    deps.ai.readMealPlan = () => Promise.reject(new Error('nope'));
    startPlanImport(deps, { text: null, photos: [Buffer.from('x')] }, TODAY);
    await settle();
    expect(planImportView(deps)).toMatchObject({ status: 'failed', canRetry: false });
    expect(() => retryPlanImport(deps, TODAY)).toThrow(/photo again/);
  });

  it('calls a read lost to a restart failed after a while', async () => {
    const { deps } = setUp([]);
    deps.ai.readMealPlan = () => new Promise(() => undefined);
    startPlanImport(deps, { text: 'tacos', photos: [] }, TODAY);
    expect(planImportView(deps, new Date('2026-11-06T12:06:00'))).toMatchObject({ status: 'failed', canRetry: true });
  });

  it('lets a newer import or a discard win over a read still going', async () => {
    const { deps } = setUp([]);
    const held = deferred<SaidPlanMeal[]>();
    deps.ai.readMealPlan = () => held.promise;
    startPlanImport(deps, { text: 'old', photos: [] }, TODAY);
    discardPlanImport(deps);
    held.resolve([said({})]);
    await settle();
    expect(planImportView(deps)).toEqual({ status: 'none' });
  });
});

describe('saving a plan', () => {
  it('saves nothing until confirmed', async () => {
    const { deps } = setUp([said({})]);
    await read(deps);
    expect(deps.plan.range('0000-01-01', '9999-12-31')).toEqual([]);
  });

  it('saves a recipe, a named meal, leftovers and an extra, all pinned', async () => {
    const { deps } = setUp([said({})]);
    const { id } = await read(deps);
    confirmPlanImport(deps, id, [
      place('2026-11-10', 'dinner', { kind: 'recipe', slug: 'chicken-tacos', title: 'Chicken tacos' }),
      place('2026-11-11', 'dinner', NAMED),
      place('2026-11-12', 'lunch', { kind: 'leftovers' }),
      place('2026-11-14', 'extra', { kind: 'recipe', slug: 'cake', title: 'Cake' }),
    ], TODAY);
    expect(deps.plan.get('2026-11-10', 'dinner')).toMatchObject({ kind: 'recipe', recipeSlug: 'chicken-tacos', pinned: true });
    expect(deps.plan.get('2026-11-11', 'dinner')).toMatchObject({ kind: 'note', note: 'Tacos', pinned: true });
    expect(deps.plan.get('2026-11-12', 'lunch')).toMatchObject({ kind: 'leftovers', leftoversOf: null, pinned: true });
    expect(extrasOnly(deps.plan.range('2026-11-14', '2026-11-14'))[0]).toMatchObject({ recipeSlug: 'cake', pinned: true });
    expect(planImportView(deps)).toMatchObject({ status: 'saved', saved: 4, leftAlone: 0 });
  });

  it('adds extras once, however many times the confirmation is sent', async () => {
    const { deps } = setUp([said({})]);
    const { id } = await read(deps);
    const cake = [place('2026-11-14', 'extra', { kind: 'recipe', slug: 'cake', title: 'Cake' })];
    confirmPlanImport(deps, id, cake, TODAY);
    expect(() => confirmPlanImport(deps, id, cake, TODAY)).toThrow(/already saved/);
    expect(deps.plan.range('2026-11-14', '2026-11-14')).toHaveLength(1);
  });

  it('replaces what’s planned, but not a meal already made, nor a day gone by', async () => {
    const { deps } = setUp([said({})]);
    deps.plan.upsert({ ...blankEntry('2026-11-10', 'dinner'), kind: 'recipe', recipeSlug: 'soup' });
    deps.plan.upsert({ ...blankEntry(TODAY, 'lunch'), kind: 'recipe', recipeSlug: 'soup', outcome: 'made' });
    const { id } = await read(deps);
    confirmPlanImport(deps, id, [place('2026-11-10', 'dinner', NAMED), place(TODAY, 'lunch', NAMED), place('2026-11-01', 'dinner', NAMED)], TODAY);
    expect(deps.plan.get('2026-11-10', 'dinner')).toMatchObject({ kind: 'note', note: 'Tacos', pinned: true });
    expect(deps.plan.get(TODAY, 'lunch')).toMatchObject({ recipeSlug: 'soup', outcome: 'made' });
    expect(deps.plan.get('2026-11-01', 'dinner')).toBeNull();
    expect(planImportView(deps)).toMatchObject({ saved: 1, leftAlone: 2 });
  });

  it('refuses two meals in one slot, and an unknown id', async () => {
    const { deps } = setUp([said({})]);
    const { id } = await read(deps);
    expect(() => confirmPlanImport(deps, id, [place('2026-11-10', 'dinner', NAMED), place('2026-11-10', 'dinner', NAMED)], TODAY)).toThrow(/same slot/);
    expect(() => confirmPlanImport(deps, 'other', [], TODAY)).toThrow(/already saved/);
    expect(deps.plan.range('2026-11-10', '2026-11-10')).toEqual([]);
  });

  it('refuses leftovers as an extra', async () => {
    const { deps } = setUp([said({})]);
    const { id } = await read(deps);
    expect(() => confirmPlanImport(deps, id, [place('2026-11-10', 'extra', { kind: 'leftovers' })], TODAY)).toThrow(/can’t be an extra/);
  });

  it('survives the pantry check, and filling in only touches open slots', async () => {
    const { deps } = setUp([said({})]);
    const { id } = await read(deps);
    // Dinner tonight needs chicken nobody has; a person chose it, so it stays.
    confirmPlanImport(deps, id, [place(TODAY, 'dinner', { kind: 'recipe', slug: 'cake', title: 'Cake' }), place(TODAY, 'extra', NAMED)], TODAY);
    expect(keepPlanCookable(deps, TODAY)).toEqual([]);
    await planAhead(deps, TODAY, TODAY);
    expect(deps.plan.get(TODAY, 'dinner')?.recipeSlug).toBe('cake');
    expect(deps.plan.get(TODAY, 'breakfast')?.recipeSlug).toBe('toast');
    expect(extrasOnly(deps.plan.range(TODAY, TODAY))).toHaveLength(1);
  });

  it('saves all of it or none: a recipe gone since the read undoes the rest, and it can still be saved', async () => {
    const deps = transactionalFakes([recipe('soup', ['1 can broth'])]).deps as unknown as Deps;
    deps.ai = { available: () => true, readMealPlan: () => Promise.resolve([said({})]) } as unknown as Deps['ai'];
    const settings = new Map<string, string>();
    deps.household = { setting: (key: string) => settings.get(key) ?? null, saveSetting: (key: string, value: string | null) => void (value === null ? settings.delete(key) : settings.set(key, value)) } as unknown as Deps['household'];
    const { id } = await read(deps);
    expect(() => confirmPlanImport(deps, id, [
      place('2026-11-10', 'dinner', NAMED),
      place('2026-11-10', 'extra', { kind: 'recipe', slug: 'gone', title: 'Gone' }),
    ], TODAY)).toThrow(/no longer/);
    expect(deps.plan.range('2026-11-10', '2026-11-10')).toEqual([]);
    expect(planImportView(deps).status).toBe('ready');
    confirmPlanImport(deps, id, [place('2026-11-10', 'dinner', NAMED)], TODAY);
    expect(deps.plan.range('2026-11-10', '2026-11-10')).toHaveLength(1);
  });

  it('stops opening to a saved import after a day', async () => {
    const { deps } = setUp([said({})]);
    const { id } = await read(deps);
    confirmPlanImport(deps, id, [], TODAY);
    expect(planImportView(deps, new Date('2026-11-08T12:00:00'))).toEqual({ status: 'none' });
  });
});
