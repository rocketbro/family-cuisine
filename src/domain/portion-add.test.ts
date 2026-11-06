import { describe, expect, it } from 'vitest';
import { additionAsChange, portionsAfterAdding } from './portion-add.ts';
import type { Portion } from './portions.ts';
import { pantryItem } from './test-fixtures.ts';

describe('adding stock', () => {
  const today = '2026-11-06';
  const portion = (storage: Portion['storage'], amount: number | null, unit: Portion['unit'] = 'lb', useBy: string | null = null): Portion => ({ storage, amount, unit, canOz: null, useBy, useByEstimated: false });

  it('goes on top of the same form, keeping its unit and date', () => {
    const item = pantryItem(1, 'beef', { portions: [portion('fresh', 1, 'lb', '2026-11-08')] });
    expect(portionsAfterAdding(item, { storage: 'fresh', amount: 2, unit: 'lb' }, today)).toEqual([portion('fresh', 3, 'lb', '2026-11-08')]);
  });
  it('starts a new form beside the others', () => {
    const item = pantryItem(1, 'beef', { portions: [portion('fresh', 1)] });
    expect(portionsAfterAdding(item, { storage: 'frozen', amount: 2, unit: 'lb' }, today).map(p => [p.storage, p.amount])).toEqual([['fresh', 1], ['frozen', 2]]);
  });
  it('lets a new form be "some"', () => {
    expect(additionAsChange(pantryItem(1, 'beef'), { storage: 'frozen', amount: null, unit: null })).toEqual({ storage: 'frozen', amount: null, unit: null });
  });
  it('can’t add to "some": it stays some', () => {
    const item = pantryItem(1, 'beef', { portions: [portion('frozen', null)] });
    expect(additionAsChange(item, { storage: 'frozen', amount: 2, unit: 'lb' }).amount).toBeNull();
  });
  it('estimates a new fresh amount from how long it lasts', () => {
    const [fresh] = portionsAfterAdding(pantryItem(1, 'milk', { lastsDays: 5 }), { storage: 'fresh', amount: 1, unit: 'quart' }, today);
    expect(fresh).toMatchObject({ useBy: '2026-11-11', useByEstimated: true });
  });
  it('a plain item keeps the date off its package, unless it’s being frozen', () => {
    const milk = pantryItem(1, 'milk', { useBy: '2026-11-20' });
    expect(portionsAfterAdding(milk, { storage: 'fresh', amount: 1, unit: 'quart' }, today)[0].useBy).toBe('2026-11-20');
    expect(portionsAfterAdding(milk, { storage: 'frozen', amount: 1, unit: 'quart' }, today)[0].useBy).toBeNull();
  });
});
