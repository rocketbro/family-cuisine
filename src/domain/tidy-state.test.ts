// The tidy-up's schedule, memory, log and merging.
import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { pantryItem } from './test-fixtures.ts';
import { tidySummary, withRun, type TidyRun } from './tidy-log.ts';
import { ASKED_QUIET_DAYS, roomForQuestions, stillQuiet, stillWaiting, withQuiet } from './tidy-memory.ts';
import { mergePatch } from './tidy-merge.ts';
import type { PendingQuestion } from './tidy-questions.ts';
import { tidyPeriod, tidyUpWindowOpen } from './tidy-schedule.ts';

describe('the schedule', () => {
  it('gives each run of three days one key, never later than the day itself', () => {
    const days = Array.from({ length: 9 }, (_, i) => addDays(tidyPeriod('2026-11-10'), i));
    const keys = days.map(tidyPeriod);
    expect(new Set(keys).size).toBe(3);
    days.forEach((day, i) => {
      expect(keys[i] <= day).toBe(true);
      expect(keys[i] > addDays(day, -3)).toBe(true);
    });
    expect(keys[3]).toBe(addDays(keys[0], 3));
    expect(tidyPeriod(keys[0])).toBe(keys[0]);
  });

  it('runs at night, after the top-up and before the morning notices', () => {
    expect([3, 4, 5, 6, 7].map(tidyUpWindowOpen)).toEqual([false, true, true, false, false]);
  });
});

describe('what it remembers', () => {
  const pending = (askedOn: string): PendingQuestion => ({ fingerprint: askedOn, question: 'q', answers: [], askedOn });

  it('stays quiet about a fingerprint until its day, then forgets it', () => {
    const quiet = withQuiet({}, ['a'], ASKED_QUIET_DAYS, '2026-11-12');
    expect(stillQuiet(quiet, '2026-12-01')).toEqual({ a: '2027-02-10' });
    expect(stillQuiet(quiet, '2027-02-10')).toEqual({});
  });

  it('lets old questions lapse and counts the room left', () => {
    const waiting = stillWaiting([pending('2026-10-01'), pending('2026-11-10')], '2026-11-12');
    expect(waiting.map(p => p.askedOn)).toEqual(['2026-11-10']);
    expect(roomForQuestions(waiting)).toBe(2);
    expect(roomForQuestions([pending('a'), pending('b'), pending('c'), pending('d')])).toBe(0);
  });
});

describe('the log', () => {
  const run = (key: string, extra: Partial<TidyRun> = {}): TidyRun => ({ key, on: key, fixed: [], asked: 0, askedClaude: false, ...extra });

  it('puts the latest first and adds a retry to its own entry', () => {
    const first = withRun([run('2026-11-01')], run('2026-11-09', { fixed: ['a'] }), '2026-11-09');
    const retried = withRun(first, run('2026-11-09', { asked: 2, askedClaude: true }), '2026-11-09');
    expect(retried).toHaveLength(2);
    expect(retried[0]).toMatchObject({ key: '2026-11-09', fixed: ['a'], asked: 2, askedClaude: true });
  });

  it('forgets runs after a month', () => {
    expect(withRun([run('2026-09-01')], run('2026-11-09'), '2026-11-09').map(r => r.key)).toEqual(['2026-11-09']);
  });

  it('says it in a line', () => {
    expect(tidySummary(null)).toBe('Hasn’t run yet');
    expect(tidySummary(run('2026-11-09'))).toBe('Nov 9: nothing to fix');
    expect(tidySummary(run('2026-11-09', { fixed: ['a', 'b'], asked: 1 }))).toBe('Nov 9: fixed 2 things, asked 1 question');
  });
});

describe('folding one item into another', () => {
  it('keeps the first, with the other’s name and other names', () => {
    const patch = mergePatch(pantryItem(1, 'oats', { alsoCalled: ['oatmeal'] }), pantryItem(2, 'rolled oats', { alsoCalled: ['porridge oats'] }), null, []);
    expect(patch).toEqual({ alsoCalled: ['oatmeal', 'rolled oats', 'porridge oats'] });
  });

  it('renames, keeping the old name as another', () => {
    const patch = mergePatch(pantryItem(1, 'oats'), pantryItem(2, 'rolled oats'), 'rolled oats', []);
    expect(patch).toEqual({ name: 'rolled oats', alsoCalled: ['oats'] });
  });

  it('adds counts, and takes the other’s stock only when its own is out', () => {
    expect(mergePatch(pantryItem(1, 'a', { count: 3 }), pantryItem(2, 'b', { count: 4 }), null, [])).toMatchObject({ count: 7 });
    expect(mergePatch(pantryItem(1, 'a', { status: 'out' }), pantryItem(2, 'b', { status: 'low', useBy: '2026-11-20' }), null, []))
      .toMatchObject({ status: 'low', count: null, useBy: '2026-11-20' });
    expect(mergePatch(pantryItem(1, 'a'), pantryItem(2, 'b', { status: 'low' }), null, [])).not.toHaveProperty('status');
  });

  it('keeps the sooner date', () => {
    expect(mergePatch(pantryItem(1, 'a', { useBy: '2026-11-30' }), pantryItem(2, 'b', { useBy: '2026-11-20' }), null, [])).toMatchObject({ useBy: '2026-11-20' });
  });
});
