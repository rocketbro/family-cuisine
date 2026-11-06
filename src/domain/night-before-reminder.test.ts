import { describe, expect, it } from 'vitest';
import { nightBeforeNotice, nightBeforeTasks, reminderWindowOpen, type NightBeforeTask } from './night-before-reminder.ts';
import { extraSlot } from './plan-slot.ts';
import { blankEntry, type PlanEntry } from './plan.ts';

const tomorrow = '2026-11-09';
const cooks = (slug: string, slot: PlanEntry['slot'] = 'dinner', extra: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(tomorrow, slot), kind: 'recipe', recipeSlug: slug, ...extra });
const book: Record<string, { title: string; nightBefore: string | null }> = {
  beans: { title: 'Black Bean Soup', nightBefore: 'Soak the beans overnight' },
  roast: { title: 'Roast', nightBefore: 'Rub the roast and chill it' },
  toast: { title: 'Toast', nightBefore: null },
};
const tasks = (entries: PlanEntry[]) => nightBeforeTasks(entries, slug => book[slug]);

describe('what tomorrow asks of tonight', () => {
  it('finds a meal with a step, and leaves the rest out', () => {
    expect(tasks([cooks('beans'), cooks('toast', 'breakfast')]).map(t => t.slug)).toEqual(['beans']);
  });

  it('counts an extra like a meal', () => {
    expect(tasks([cooks('beans', extraSlot(4))])[0]).toMatchObject({ slug: 'beans', slot: 'extra-4' });
  });

  it.each(['made', 'swapped', 'skipped'] as const)('skips a meal already %s', outcome => {
    expect(tasks([cooks('beans', 'dinner', { outcome })])).toEqual([]);
  });

  it('skips leftovers and names, and a recipe no longer in the book', () => {
    expect(tasks([cooks('beans', 'lunch', { kind: 'leftovers' }), cooks('beans', 'dinner', { kind: 'note' }), cooks('gone')])).toEqual([]);
  });

  it('lists a recipe once, even on two meals', () => {
    expect(tasks([cooks('beans', 'lunch'), cooks('beans', extraSlot(1))])).toHaveLength(1);
  });
});

describe('the notification', () => {
  const task = (slug: string, multiplier = 1): NightBeforeTask => ({ slug, title: book[slug].title, step: book[slug].nightBefore!, date: tomorrow, slot: 'dinner', multiplier });

  it('says nothing when there’s nothing to do', () => {
    expect(nightBeforeNotice([])).toBeNull();
  });

  it('names the dish and the step, and opens the recipe at the planned size', () => {
    expect(nightBeforeNotice([task('beans', 2)])).toEqual({
      title: 'Tomorrow: Black Bean Soup',
      body: 'Soak the beans overnight.',
      url: '/recipes/beans?x=2&date=2026-11-09&slot=dinner',
    });
  });

  it('combines several into one, opening the day', () => {
    expect(nightBeforeNotice([task('beans'), task('roast')])).toEqual({
      title: 'Tonight, for tomorrow’s meals',
      body: 'Black Bean Soup: soak the beans overnight. Roast: rub the roast and chill it.',
      url: '/day/2026-11-09',
    });
  });
});

describe('the time window', () => {
  const five = 17 * 60;
  it('opens at the set time, and stays open three hours', () => {
    expect(reminderWindowOpen(five - 1, five)).toBe(false);
    expect(reminderWindowOpen(five, five)).toBe(true);
    expect(reminderWindowOpen(five + 179, five)).toBe(true);
    expect(reminderWindowOpen(five + 180, five)).toBe(false);
  });
  it('doesn’t carry a late setting past midnight', () => {
    expect(reminderWindowOpen(23 * 60 + 30, 23 * 60)).toBe(true);
    expect(reminderWindowOpen(30, 23 * 60)).toBe(false);
  });
});
