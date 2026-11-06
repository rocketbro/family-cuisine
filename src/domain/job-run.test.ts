import { describe, expect, it } from 'vitest';
import { jobClaimable } from './job-run.ts';

describe('scheduled job runs', () => {
  const now = '2026-11-08T12:00:00.000Z';
  it('can be claimed when new, or when the lease has run out', () => {
    expect(jobClaimable(null, now)).toBe(true);
    expect(jobClaimable({ completedAt: null, leaseUntil: '2026-11-08T11:59:00.000Z' }, now)).toBe(true);
    expect(jobClaimable({ completedAt: null, leaseUntil: now }, now)).toBe(true);
  });
  it('can\'t be claimed while leased, once finished, or with a claim that never expires', () => {
    expect(jobClaimable({ completedAt: null, leaseUntil: '2026-11-08T12:01:00.000Z' }, now)).toBe(false);
    expect(jobClaimable({ completedAt: now, leaseUntil: null }, now)).toBe(false);
    expect(jobClaimable({ completedAt: null, leaseUntil: null }, now)).toBe(false);
  });
});
