import { describe, expect, it } from 'vitest';
import { pantryItem } from '../../../../domain/test-fixtures.ts';
import { amountFrom, COUNT, goalUnits, packFields, packFrom, packUnitFor, startingStorage, startingUnit } from './goal-form.ts';

describe('the goal form', () => {
  it('takes only positive numbers', () => {
    expect(amountFrom('10')).toBe(10);
    expect(amountFrom(' 2.5 ')).toBe(2.5);
    for (const bad of ['', '0', '-1', 'lots', '10 lb']) expect(amountFrom(bad)).toBeNull();
  });

  it('starts from how the item is already kept', () => {
    const frozen = pantryItem(1, 'beef', { portions: [{ storage: 'frozen', amount: 3, unit: 'lb', canOz: null, useBy: null, useByEstimated: false }] });
    expect(startingStorage(frozen)).toBe('frozen');
    expect(startingUnit(frozen, 'frozen')).toBe('lb');
    const canned = pantryItem(2, 'tuna', { portions: [{ storage: 'canned', amount: 4, unit: 'can', canOz: null, useBy: null, useByEstimated: false }] });
    expect(startingStorage(canned)).toBe('canned');
    expect(startingUnit(canned, 'canned')).toBe('can');
    expect(startingUnit(pantryItem(3, 'oil'), 'canned')).toBe('can');
    expect(startingUnit(pantryItem(3, 'oil'), 'frozen')).toBe('lb');
  });

  it('keeps a saved unit that is not among the usual choices', () => {
    expect(goalUnits('cup').map(u => u.value)).toContain('cup');
    expect(goalUnits('lb').filter(u => u.value === 'lb')).toHaveLength(1);
  });

  it('suggests a package unit that can count toward the goal', () => {
    expect(packUnitFor('lb')).toBe('lb');
    expect(packUnitFor('can')).toBe(COUNT);
    expect(packUnitFor('package')).toBe(COUNT);
    expect(packUnitFor(COUNT)).toBe(COUNT);
  });

  it('reads and writes a package size', () => {
    expect(packFields({ count: null, measure: { amount: 3, unit: 'lb' } })).toEqual({ amount: '3', unit: 'lb' });
    expect(packFields({ count: 18, measure: null })).toEqual({ amount: '18', unit: COUNT });
    expect(packFields(null)).toBeNull();
    expect(packFrom(3, 'lb')).toEqual({ count: null, measure: { amount: 3, unit: 'lb' } });
    expect(packFrom(18, COUNT)).toEqual({ count: 18, measure: null });
  });
});
