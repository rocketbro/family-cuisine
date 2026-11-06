import { describe, expect, it } from 'vitest';
import type { Portion } from '../../domain/portions.ts';
import { toISODate, addDays } from '../../domain/dates.ts';
import { updatePantryItem } from './pantry.ts';
import { transactionalFakes } from './test-support/transactional-fakes.ts';
import { UserError } from './user-error.ts';

const portion = (storage: Portion['storage'], amount: number | null, useBy: string | null = null): Portion => ({ storage, amount, unit: 'lb', canOz: null, useBy, useByEstimated: false });
const freezeAll = { from: 'fresh', to: 'frozen', amount: null } as const;

function stocked(portions: Portion[], extra = {}) {
  const f = transactionalFakes();
  const item = f.addItem('sausage', { ...extra });
  f.deps.pantry.setPortions(item.id, portions);
  f.deps.pantry.update(item.id, { useBy: portions.find(p => p.useBy)?.useBy ?? null });
  return { f, id: item.id };
}

describe('moving stock', () => {
  it('freezes a past-date item: same amount, no date, no longer flagged', () => {
    const { f, id } = stocked([portion('fresh', 1, '2020-01-01')]);
    const moved = updatePantryItem(f.deps, id, { move: freezeAll })!;
    expect(moved.portions).toEqual([portion('frozen', 1)]);
    expect(moved).toMatchObject({ useBy: null, status: 'have', count: null });
  });
  it('leaves the rest of what’s stored alone on a part move, and the item takes the soonest date', () => {
    const { f, id } = stocked([portion('fresh', 3, '2030-01-01'), portion('frozen', 2)]);
    const moved = updatePantryItem(f.deps, id, { move: { ...freezeAll, amount: 1 } })!;
    expect(moved.portions.map(p => [p.storage, p.amount])).toEqual([['fresh', 2], ['frozen', 3]]);
    expect(moved.useBy).toBe('2030-01-01');
  });
  it('turns a counted item into portions, keeping the total', () => {
    const f = transactionalFakes();
    const eggs = f.addItem('chicken', { count: 3, status: 'have' });
    const moved = updatePantryItem(f.deps, eggs.id, { move: { ...freezeAll, amount: 2 } })!;
    expect(moved.count).toBeNull();
    expect(moved.portions.map(p => [p.storage, p.amount])).toEqual([['fresh', 1], ['frozen', 2]]);
  });
  it('turns a plain item into some frozen, staying low if it was', () => {
    const f = transactionalFakes();
    const milk = f.addItem('milk', { status: 'low', useBy: '2020-01-01' });
    const moved = updatePantryItem(f.deps, milk.id, { move: freezeAll })!;
    expect(moved.portions.map(p => [p.storage, p.amount])).toEqual([['frozen', null]]);
    expect(moved).toMatchObject({ status: 'low', useBy: null });
  });
  it('starts the clock on thawing', () => {
    const { f, id } = stocked([portion('frozen', 2)], { lastsDays: 3 });
    const moved = updatePantryItem(f.deps, id, { move: { from: 'frozen', to: 'fresh', amount: null } })!;
    expect(moved).toMatchObject({ useBy: addDays(toISODate(new Date()), 3), useByEstimated: true });
  });
  it('says why, and changes nothing, when it can’t', () => {
    const { f, id } = stocked([portion('fresh', 1)]);
    expect(() => updatePantryItem(f.deps, id, { move: { ...freezeAll, amount: 5 } })).toThrow(UserError);
    expect(f.item(id).portions.map(p => p.amount)).toEqual([1]);
  });
});

describe('adding stock', () => {
  it('raises the total of the same form', () => {
    const { f, id } = stocked([portion('frozen', 2)]);
    const added = updatePantryItem(f.deps, id, { add: { storage: 'frozen', amount: 1, unit: 'lb' } })!;
    expect(added.portions.map(p => [p.storage, p.amount])).toEqual([['frozen', 3]]);
  });
  it('gives a plain item its first amount, with an estimate from how long it lasts', () => {
    const f = transactionalFakes();
    const milk = f.addItem('milk', { lastsDays: 5 });
    const added = updatePantryItem(f.deps, milk.id, { add: { storage: 'fresh', amount: 1, unit: 'quart' } })!;
    expect(added.portions[0]).toMatchObject({ amount: 1, unit: 'quart', useByEstimated: true });
    expect(added.useBy).toBe(addDays(toISODate(new Date()), 5));
  });
});
