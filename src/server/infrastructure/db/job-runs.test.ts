// The SQL behind leases and conditional fills, which the application tests only fake.
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { blankEntry } from '../../../domain/plan.ts';
import { sqliteHouseholdRepository } from './household-repository.ts';
import { migrate } from './migrations.ts';
import { sqlitePlanRepository } from './plan-repository.ts';

function openMemory() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

describe('job runs in SQLite', () => {
  const NOW = '2026-11-08T12:00:00.000Z';
  const LATER = '2026-11-08T12:15:00.000Z';

  it('holds a lease until it runs out, and a finished run for good', () => {
    const jobs = sqliteHouseholdRepository(openMemory());
    expect(jobs.claimJob('weekly-plan', 'k', NOW, LATER)).toBe(true);
    expect(jobs.claimJob('weekly-plan', 'k', NOW, LATER)).toBe(false);
    expect(jobs.jobCompleted('weekly-plan', 'k')).toBe(false);
    expect(jobs.claimJob('weekly-plan', 'k', LATER, '2026-11-08T12:30:00.000Z')).toBe(true);
    jobs.completeJob('weekly-plan', 'k');
    expect(jobs.jobCompleted('weekly-plan', 'k')).toBe(true);
    expect(jobs.claimJob('weekly-plan', 'k', '2027-01-01T00:00:00.000Z', null)).toBe(false);
  });

  it('never gives back a claim with no lease, unless released', () => {
    const jobs = sqliteHouseholdRepository(openMemory());
    expect(jobs.claimJob('checkin', 'k', NOW, null)).toBe(true);
    expect(jobs.claimJob('checkin', 'k', '2027-01-01T00:00:00.000Z', null)).toBe(false);
    jobs.releaseJob('checkin', 'k', LATER);
    expect(jobs.claimJob('checkin', 'k', NOW, null)).toBe(false);
    expect(jobs.claimJob('checkin', 'k', LATER, null)).toBe(true);
  });
});

describe('filling the plan in SQLite', () => {
  it('adds a meal only to an empty slot', () => {
    const plan = sqlitePlanRepository(openMemory());
    const pinned = { ...blankEntry('2026-11-03', 'dinner'), note: 'Ours', pinned: true };
    expect(plan.fillIfOpen(pinned)).toBe(true);
    expect(plan.fillIfOpen({ ...blankEntry('2026-11-03', 'dinner'), note: 'The planner’s' })).toBe(false);
    expect(plan.get('2026-11-03', 'dinner')).toEqual(pinned);
  });
});
