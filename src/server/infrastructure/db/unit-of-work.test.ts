import { describe, expect, it } from 'vitest';
import { openDatabase } from './connection.ts';
import { sqliteHouseholdRepository } from './household-repository.ts';
import { sqlitePantryRepository } from './pantry-repository.ts';
import { sqlitePlanRepository } from './plan-repository.ts';
import { blankEntry } from '../../../domain/plan.ts';
import { sqliteUnitOfWork } from './unit-of-work.ts';

function repositories() {
  const db = openDatabase(':memory:');
  return { db, unitOfWork: sqliteUnitOfWork(db), pantry: sqlitePantryRepository(db), plan: sqlitePlanRepository(db), household: sqliteHouseholdRepository(db) };
}

describe('the SQLite unit of work', () => {
  it('commits across repositories and returns what the work returned', () => {
    const { unitOfWork, pantry, household } = repositories();
    const id = unitOfWork.run(() => {
      household.saveSetting('budget', '100');
      return pantry.create({ name: 'eggs', count: 12 }).id;
    });
    expect(pantry.get(id)?.count).toBe(12);
    expect(household.setting('budget')).toBe('100');
  });

  it('rolls back every repository when the work throws', () => {
    const { unitOfWork, pantry, plan, household } = repositories();
    const eggs = pantry.create({ name: 'eggs', count: 12 });
    expect(() => unitOfWork.run(() => {
      pantry.update(eggs.id, { count: 0 });
      pantry.setPortions(eggs.id, [{ storage: 'fresh', amount: 1, unit: null, canOz: null, useBy: null, useByEstimated: false }]);
      plan.upsert(blankEntry('2026-11-04', 'dinner'));
      household.markCheckin('2026-11-04', 'pantry');
      throw new Error('halfway');
    })).toThrow('halfway');
    expect(pantry.get(eggs.id)).toMatchObject({ count: 12, portions: [] });
    expect(plan.get('2026-11-04', 'dinner')).toBeNull();
    expect(household.checkin('2026-11-04').pantryDone).toBe(false);
  });

  it('nests, with the outer failure undoing the inner work', () => {
    const { unitOfWork, household } = repositories();
    expect(() => unitOfWork.run(() => {
      unitOfWork.run(() => household.saveSetting('inner', '1'));
      throw new Error('outer');
    })).toThrow('outer');
    expect(household.setting('inner')).toBeNull();
  });

  it('refuses asynchronous work rather than committing early', () => {
    const { unitOfWork } = repositories();
    expect(() => unitOfWork.run(async () => {})).toThrow('promise');
  });
});
