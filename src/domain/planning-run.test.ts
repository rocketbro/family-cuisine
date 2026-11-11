import { describe, expect, it } from 'vitest';
import { mergedRequests, rangeToFill, runCovers } from './planning-run.ts';

describe('combining requests to plan', () => {
  const today = '2026-11-03';
  it('joins a run that does at least as much', () => {
    expect(runCovers({ today, through: '2026-11-10' }, { today, through: '2026-11-04' })).toBe(true);
    expect(runCovers({ today, through: '2026-11-04' }, { today, through: null })).toBe(true);
    expect(runCovers({ today, through: '2026-11-04' }, { today, through: '2026-11-10' })).toBe(false);
    expect(runCovers({ today, through: null }, { today, through: '2026-11-04' })).toBe(false);
    expect(runCovers({ today: '2026-11-02', through: '2026-11-10' }, { today, through: '2026-11-04' })).toBe(false);
  });
  it('merges to the widest', () => {
    expect(mergedRequests({ today, through: null }, { today, through: '2026-11-04' })).toEqual({ today, through: '2026-11-04' });
    expect(mergedRequests({ today, through: '2026-11-10' }, { today: '2026-11-04', through: '2026-11-04' })).toEqual({ today: '2026-11-04', through: '2026-11-10' });
    expect(mergedRequests({ today, through: null }, { today, through: null })).toEqual({ today, through: null });
  });
  it('holds to the book when asked: an open run can’t stand in, and a merge stays held', () => {
    const through = '2026-11-10';
    expect(runCovers({ today, through }, { today, through, bookOnly: true })).toBe(false);
    expect(runCovers({ today, through, bookOnly: true }, { today, through, bookOnly: true })).toBe(true);
    expect(runCovers({ today, through, bookOnly: true }, { today, through })).toBe(true);
    expect(mergedRequests({ today, through }, { today, through, bookOnly: true })).toEqual({ today, through, bookOnly: true });
  });
  it('fills one range over what was asked and what came off', () => {
    expect(rangeToFill({ today, through: null }, [])).toBeNull();
    expect(rangeToFill({ today, through: '2026-11-04' }, [])).toEqual({ from: today, through: '2026-11-04' });
    expect(rangeToFill({ today, through: null }, ['2026-11-06', '2026-11-05'])).toEqual({ from: '2026-11-05', through: '2026-11-06' });
    expect(rangeToFill({ today, through: '2026-11-04' }, ['2026-11-06'])).toEqual({ from: today, through: '2026-11-06' });
  });
});
