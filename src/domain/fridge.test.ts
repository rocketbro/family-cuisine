import { describe, expect, it } from 'vitest';
import {
  cleanFridgeText, FRIDGE_DAYS, fridgeAge, fridgeForModel, inTheFridge, withFridgeLine, withoutDinnerLine, withoutEatenLeftovers, withoutFridgeLine,
  type FridgeLine,
} from './fridge.ts';
import { blankEntry, type PlanEntry } from './plan.ts';

const TODAY = '2026-11-04';
const line = (id: string, since: string, over: Partial<FridgeLine> = {}): FridgeLine => ({ id, text: `bits ${id}`, since, dinner: null, ...over });

describe('how long a line has been there', () => {
  it('says today, yesterday, then days', () => {
    expect(fridgeAge(line('a', TODAY), TODAY)).toBe('today');
    expect(fridgeAge(line('a', '2026-11-03'), TODAY)).toBe('yesterday');
    expect(fridgeAge(line('a', '2026-11-01'), TODAY)).toBe('3 days');
  });
});

describe('lines dropping off by themselves', () => {
  it('keeps a line until it has been there the default number of days', () => {
    expect(inTheFridge([line('a', '2026-10-31')], TODAY)).toHaveLength(1);
    expect(FRIDGE_DAYS).toBe(5);
    expect(inTheFridge([line('a', '2026-10-30')], TODAY)).toHaveLength(0);
  });

  it('puts the soonest gone (oldest) first, and ignores a date in the future', () => {
    const lines = [line('new', TODAY), line('old', '2026-11-01'), line('later', '2026-11-09')];
    expect(inTheFridge(lines, TODAY).map(l => l.id)).toEqual(['old', 'new']);
  });
});

describe('adding and removing', () => {
  it('drops expired lines when adding, and ignores the same words twice', () => {
    const lines = withFridgeLine([line('gone', '2026-10-01')], line('b', TODAY, { text: 'Rice' }), TODAY);
    expect(lines.map(l => l.id)).toEqual(['b']);
    expect(withFridgeLine(lines, line('c', TODAY, { text: 'rice' }), TODAY)).toHaveLength(1);
  });

  it('keeps one line per dinner', () => {
    const lines = withFridgeLine([line('a', TODAY, { dinner: TODAY })], line('b', TODAY, { text: 'Tacos', dinner: TODAY }), TODAY);
    expect(lines.map(l => l.id)).toEqual(['a']);
  });

  it('removes by id, or by the dinner it came from', () => {
    const lines = [line('a', TODAY), line('b', TODAY, { dinner: TODAY })];
    expect(withoutFridgeLine(lines, 'a').map(l => l.id)).toEqual(['b']);
    expect(withoutDinnerLine(lines, TODAY).map(l => l.id)).toEqual(['a']);
  });

  it('cleans typed words', () => {
    expect(cleanFridgeText('  sautéed   onions \n and peppers ')).toBe('sautéed onions and peppers');
    expect(cleanFridgeText('   ')).toBeNull();
  });
});

describe('eating a dinner as its leftovers', () => {
  const lines = [line('a', TODAY, { dinner: TODAY }), line('b', TODAY, { dinner: '2026-11-03' }), line('c', TODAY)];
  const leftovers = (over: Partial<PlanEntry>): PlanEntry => ({ ...blankEntry('2026-11-05', 'lunch'), kind: 'leftovers', leftoversOf: { date: TODAY, slot: 'dinner' }, ...over });

  it('uses up the line of the dinner they were of once made', () => {
    expect(withoutEatenLeftovers(lines, leftovers({ outcome: 'made' })).map(l => l.id)).toEqual(['b', 'c']);
  });

  it('does nothing while only planned, when skipped, or with no source dinner', () => {
    expect(withoutEatenLeftovers(lines, leftovers({}))).toHaveLength(3);
    expect(withoutEatenLeftovers(lines, leftovers({ outcome: 'skipped' }))).toHaveLength(3);
    expect(withoutEatenLeftovers(lines, leftovers({ outcome: 'made', leftoversOf: null }))).toHaveLength(3);
    expect(withoutEatenLeftovers(lines, { ...blankEntry('2026-11-05', 'lunch'), outcome: 'made' })).toHaveLength(3);
  });
});

describe('what the model is told', () => {
  it('lists the live lines oldest first with their age', () => {
    const told = fridgeForModel([line('new', TODAY), line('old', '2026-11-01'), line('gone', '2026-10-01')], TODAY);
    expect(told).toEqual([
      { text: 'bits old', since: 'Sunday 2026-11-01', daysThere: 3 },
      { text: 'bits new', since: 'Wednesday 2026-11-04', daysThere: 0 },
    ]);
  });
});
