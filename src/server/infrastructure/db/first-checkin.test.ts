import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { sqliteHouseholdRepository } from './household-repository.ts';
import { migrate } from './migrations.ts';

describe('the first check-in on record', () => {
  it('is nothing until someone checks in, then the earliest day', () => {
    const db = new Database(':memory:');
    migrate(db);
    const household = sqliteHouseholdRepository(db);
    expect(household.firstCheckin()).toBeNull();
    household.markCheckin('2026-11-10', 'meals');
    household.markCheckin('2026-11-03', 'pantry');
    expect(household.firstCheckin()).toBe('2026-11-03');
  });
});
