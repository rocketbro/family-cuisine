import { describe, expect, it } from 'vitest';
import type { ListenContext, ProposedChange } from '../../shared/api-types.ts';
import { checkinView, recordMeal, recordPantry } from './checkin.ts';
import { applyProposal, listen } from './listen.ts';
import { recipe } from '../../domain/test-fixtures.ts';
import { finishCooking } from './test-support/cook-meal.ts';
import { failOnce, plannedRecipe, TODAY, transactionalFakes } from './test-support/transactional-fakes.ts';

const cooked = (slug = 'omelet', factor = 1): ListenContext => ({ kind: 'cooked', date: TODAY, slot: 'dinner', slug, factor });
const eggsNow = (id: number, count: number): ProposedChange => ({ name: 'eggs', status: 'have', count, isNew: false, category: 'Dairy & eggs', pantryItemId: id, current: null, useBy: null, lastsDays: null, keepStocked: null, alsoCalled: null, portions: null });

function cookedDinner() {
  const f = transactionalFakes([recipe('omelet', ['4 eggs', '1 lb ham']), recipe('tacos', ['1 lb ham'])]);
  const eggs = f.addItem('eggs', { count: 12 });
  const ham = f.addItem('ham', { portions: [{ storage: 'fresh', amount: 3, unit: 'lb', canOz: null, useBy: null, useByEstimated: false }] });
  f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'omelet'));
  finishCooking(f.deps, { slug: 'omelet', factor: 2, today: TODAY, hour: 18, date: TODAY, slot: 'dinner' });
  f.deps.household.markCheckin(TODAY, 'meals');
  return { f, eggs, ham };
}

describe('a cooked meal and its review', () => {
  it('leaves the meal for the check-in when no changes were saved', () => {
    const { f, eggs, ham } = cookedDinner();
    const { questions } = checkinView(f.deps, TODAY);
    expect(questions.counts).toEqual([expect.objectContaining({ pantryItemId: eggs.id, estimate: 8 })]);

    recordPantry(f.deps, TODAY, { counts: [{ pantryItemId: eggs.id, used: 8 }], needs: [], uses: [] });
    expect(f.item(eggs.id).count).toBe(4);
    expect(f.item(ham.id).portions[0].amount).toBe(1);
  });

  it('settles the meal when the review’s changes are saved', () => {
    const { f, eggs, ham } = cookedDinner();
    applyProposal(f.deps, { pantry: [eggsNow(eggs.id, 4)], meals: [], context: cooked() });
    expect(f.entry(TODAY, 'dinner')?.pantrySettled).toBe(true);
    expect(checkinView(f.deps, TODAY).questions.counts).toEqual([]);

    recordPantry(f.deps, TODAY, { counts: [], needs: [], uses: [] });
    expect(f.item(eggs.id).count).toBe(4);
    expect(f.item(ham.id).portions[0].amount).toBe(3);
  });

  it('doesn’t settle it when the review saved no pantry changes', () => {
    const { f } = cookedDinner();
    applyProposal(f.deps, { pantry: [], meals: [], context: cooked() });
    expect(f.entry(TODAY, 'dinner')?.pantrySettled).toBe(false);
  });

  it('settles it together with the changes, or not at all', () => {
    const { f, eggs } = cookedDinner();
    failOnce(f.ports.plan, 'upsert');
    expect(() => applyProposal(f.deps, { pantry: [eggsNow(eggs.id, 4)], meals: [], context: cooked() })).toThrow();
    expect(f.item(eggs.id).count).toBe(12);
    expect(f.entry(TODAY, 'dinner')?.pantrySettled).toBe(false);
  });

  it('other contexts never settle a meal', () => {
    const { f, eggs } = cookedDinner();
    applyProposal(f.deps, { pantry: [eggsNow(eggs.id, 4)], meals: [], context: { kind: 'pantry' } });
    expect(f.entry(TODAY, 'dinner')?.pantrySettled).toBe(false);
  });

  it('keeps the review from touching the meal it was just told about', async () => {
    const { f } = cookedDinner();
    f.ports.ai.interpret = async () => ({ summary: '', pantry: [], meals: [{ date: TODAY, slot: 'dinner', outcome: 'made', recipeSlug: null, note: null, uses: null }], questions: [] }) as never;
    const proposal = await listen(f.deps, { text: '', context: cooked(), today: TODAY });
    expect(proposal.meals).toEqual([]);
  });

  it('keeps the size it was cooked at when the check-in says the same thing', () => {
    const f = transactionalFakes([recipe('omelet', ['4 eggs']), recipe('tacos', ['1 lb ham'])]);
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'omelet'));
    finishCooking(f.deps, { slug: 'tacos', factor: 3, today: TODAY, hour: 18, date: TODAY, slot: 'dinner' });
    recordMeal(f.deps, { date: TODAY, slot: 'dinner', outcome: 'swapped', recipeSlug: 'tacos', note: null });
    expect(f.entry(TODAY, 'dinner')).toMatchObject({ outcome: 'swapped', outcomeSlug: 'tacos', multiplier: 3 });
  });

  it('still lets the check-in correct a meal that isn’t settled', () => {
    const { f } = cookedDinner();
    recordMeal(f.deps, { date: TODAY, slot: 'dinner', outcome: 'skipped', recipeSlug: null, note: null });
    expect(f.entry(TODAY, 'dinner')?.outcome).toBe('skipped');
  });
});

describe('applying a proposal', () => {
  it('saves pantry and meals together', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('eggs', { count: 12 });
    f.deps.plan.upsert(plannedRecipe(TODAY, 'dinner', 'omelet'));
    failOnce(f.ports.household, 'markCheckin');
    expect(() => applyProposal(f.deps, {
      pantry: [eggsNow(eggs.id, 4)],
      meals: [{ date: TODAY, slot: 'dinner', outcome: 'made', recipeSlug: null, note: null }],
      context: { kind: 'checkin', date: TODAY },
    })).toThrow();
    expect(f.item(eggs.id).count).toBe(12);
    expect(f.entry(TODAY, 'dinner')?.outcome).toBeNull();
  });
});

describe('a cook review saved after the check-in settled the meal', () => {
  function settled() {
    const { f, eggs, ham } = cookedDinner();
    recordPantry(f.deps, TODAY, { counts: [{ pantryItemId: eggs.id, used: 8 }], needs: [], uses: [] });
    return { f, eggs, ham };
  }

  it('doesn’t apply its changes on top', () => {
    const { f, eggs } = settled();
    expect(f.item(eggs.id).count).toBe(4);
    applyProposal(f.deps, { pantry: [eggsNow(eggs.id, 0)], meals: [], context: cooked() });
    expect(f.item(eggs.id).count).toBe(4);
    expect(f.entry(TODAY, 'dinner')?.pantrySettled).toBe(false);
  });

  it('doesn’t ask the model, and says why', async () => {
    const { f } = settled();
    f.ports.ai.interpret = async () => { throw new Error('asked the model'); };
    const proposal = await listen(f.deps, { text: 'used two more', context: cooked(), today: TODAY });
    expect(proposal).toMatchObject({ pantry: [], meals: [], questions: [], heard: 'used two more' });
    expect(proposal.summary).toContain('already');
  });

  it('still applies to a different dish cooked for that meal', () => {
    const { f, eggs } = settled();
    finishCooking(f.deps, { slug: 'tacos', factor: 1, today: TODAY, hour: 20, date: TODAY, slot: 'dinner' });
    applyProposal(f.deps, { pantry: [eggsNow(eggs.id, 1)], meals: [], context: cooked('tacos') });
    expect(f.item(eggs.id).count).toBe(1);
    expect(f.entry(TODAY, 'dinner')?.pantrySettled).toBe(true);
  });

  it('still saves a review from before, when the check-in hasn’t happened', () => {
    const { f, eggs } = cookedDinner();
    applyProposal(f.deps, { pantry: [eggsNow(eggs.id, 4)], meals: [], context: cooked() });
    expect(f.item(eggs.id).count).toBe(4);
  });
});
