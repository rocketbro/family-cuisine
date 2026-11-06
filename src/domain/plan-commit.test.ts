import { describe, expect, it } from 'vitest';
import { plannedToCommit } from './plan-commit.ts';
import { blankEntry, leftoversOfRemoved, type PlanEntry } from './plan.ts';

describe('what a planning run may commit', () => {
  const dinner = (date: string, extra: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(date, 'dinner'), kind: 'recipe', recipeSlug: 'soup', ...extra });
  const lunchOf = (date: string, source: string): PlanEntry => ({ ...blankEntry(date, 'lunch'), kind: 'leftovers', leftoversOf: { date: source, slot: 'dinner' } });

  it('never takes a slot that filled up in the meantime', () => {
    const pinned = dinner('2026-11-03', { pinned: true, recipeSlug: 'tacos' });
    expect(plannedToCommit([dinner('2026-11-03'), dinner('2026-11-04')], [pinned], [])).toEqual([dinner('2026-11-04')]);
  });
  it('takes leftovers of a dinner from this run, the plan or just before', () => {
    expect(plannedToCommit([dinner('2026-11-03'), lunchOf('2026-11-04', '2026-11-03')], [], [])).toHaveLength(2);
    expect(plannedToCommit([lunchOf('2026-11-04', '2026-11-03')], [dinner('2026-11-03')], [])).toHaveLength(1);
    expect(plannedToCommit([lunchOf('2026-11-04', '2026-11-03')], [], [dinner('2026-11-03')])).toHaveLength(1);
  });
  it('turns down leftovers of nothing, or of a dinner that wasn\'t cooked', () => {
    expect(plannedToCommit([lunchOf('2026-11-04', '2026-11-03')], [], [])).toEqual([]);
    expect(plannedToCommit([lunchOf('2026-11-04', 'someday')], [], [])).toEqual([]);
    expect(plannedToCommit([lunchOf('2026-11-04', '2026-11-03')], [dinner('2026-11-03', { outcome: 'skipped' })], [])).toEqual([]);
    expect(plannedToCommit([lunchOf('2026-11-04', '2026-11-03')], [{ ...blankEntry('2026-11-03', 'dinner'), note: 'Pizza out' }], [])).toEqual([]);
  });
  it('turns down leftovers from the future, the same day, or too long ago', () => {
    expect(plannedToCommit([lunchOf('2026-11-04', '2026-11-05')], [dinner('2026-11-05')], [])).toEqual([]);
    expect(plannedToCommit([lunchOf('2026-11-04', '2026-11-04')], [dinner('2026-11-04')], [])).toEqual([]);
    expect(plannedToCommit([lunchOf('2026-11-05', '2026-11-03')], [dinner('2026-11-03')], [])).toHaveLength(1);
    expect(plannedToCommit([lunchOf('2026-11-06', '2026-11-03')], [dinner('2026-11-03')], [])).toEqual([]);
  });
  it('turns down leftovers of a dinner this run lost its slot for', () => {
    const planned = [dinner('2026-11-03'), lunchOf('2026-11-04', '2026-11-03')];
    expect(plannedToCommit(planned, [dinner('2026-11-03', { recipeSlug: 'tacos', pinned: true })], [])).toEqual([]);
  });
  it('finds leftovers of what\'s coming off, skipping any already eaten', () => {
    const gone = dinner('2026-11-03');
    const eaten = { ...lunchOf('2026-11-04', '2026-11-03'), outcome: 'made' as const };
    const uneaten = lunchOf('2026-11-05', '2026-11-03');
    expect(leftoversOfRemoved([gone, eaten, uneaten, dinner('2026-11-06')], [gone])).toEqual([uneaten]);
  });
});
