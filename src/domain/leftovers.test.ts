import { describe, expect, it } from 'vitest';
import { dishName, leftoversFit, leftoversOfChange, madeName, sameDish } from './leftovers.ts';
import { blankEntry, type PlanEntry } from './plan.ts';

const titleOf = (slug: string) => (slug === 'gone' ? null : slug.toUpperCase());
const recipe = (over: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry('2026-11-04', 'dinner'), kind: 'recipe', recipeSlug: 'tacos', ...over });
const named = (over: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry('2026-11-04', 'dinner'), note: 'Burgers', ...over });

describe('what counts as made', () => {
  it('is nothing while it’s only planned', () => {
    expect(madeName(recipe(), titleOf)).toBeNull();
    expect(madeName(named(), titleOf)).toBeNull();
  });

  it('names a recipe, or a dinner that was only a name', () => {
    expect(madeName(recipe({ outcome: 'made' }), titleOf)).toBe('TACOS');
    expect(madeName(named({ outcome: 'made' }), titleOf)).toBe('Burgers');
  });

  it('names what was made instead after a swap', () => {
    expect(madeName(recipe({ outcome: 'swapped', outcomeSlug: 'soup' }), titleOf)).toBe('SOUP');
    expect(madeName(recipe({ outcome: 'swapped', note: 'Red beans' }), titleOf)).toBe('Red beans');
    expect(madeName(recipe({ outcome: 'swapped' }), titleOf)).toBeNull();
  });

  it('isn’t a skipped meal, or leftovers themselves', () => {
    expect(madeName(recipe({ outcome: 'skipped' }), titleOf)).toBeNull();
    expect(madeName(named({ outcome: 'skipped' }), titleOf)).toBeNull();
    expect(madeName({ ...blankEntry('2026-11-04', 'dinner'), kind: 'leftovers', outcome: 'made' }, titleOf)).toBeNull();
  });

  it('forgets a note from an earlier answer once it’s marked made again', () => {
    expect(madeName(recipe({ outcome: 'made', note: 'Red beans' }), titleOf)).toBe('TACOS');
  });
});

describe('whether a meal is still the same dish', () => {
  it('sees a name change, which comparing recipes alone misses', () => {
    expect(sameDish(named(), named({ note: 'Pizza' }))).toBe(false);
    expect(sameDish(named(), named({ outcome: 'made' }))).toBe(true);
  });

  it('sees a skip and a swap, but not a swap to the same recipe', () => {
    expect(sameDish(recipe(), recipe({ outcome: 'skipped' }))).toBe(false);
    expect(sameDish(recipe(), recipe({ outcome: 'swapped', outcomeSlug: 'soup' }))).toBe(false);
    expect(sameDish(recipe(), recipe({ outcome: 'made', multiplier: 2 }))).toBe(true);
    expect(sameDish(recipe({ recipeSlug: 'soup' }), recipe({ outcome: 'swapped', outcomeSlug: 'soup' }))).toBe(true);
  });

  it('doesn’t describe a recipe that’s gone', () => {
    expect(dishName(recipe({ recipeSlug: 'gone' }), titleOf)).toBeNull();
  });
});

describe('leftovers of a meal that changed', () => {
  const dinner = recipe();
  const of = { date: dinner.date, slot: 'dinner' as const };
  const lunch = (date: string, over: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(date, 'lunch'), kind: 'leftovers', leftoversOf: of, ...over });

  it('takes planned ones off, leaves pinned ones plain, and leaves eaten ones and others alone', () => {
    const planned = lunch('2026-11-05');
    const pinned = lunch('2026-11-06', { pinned: true });
    const eaten = lunch('2026-11-07', { outcome: 'made' });
    const other = { ...lunch('2026-11-08'), leftoversOf: { date: '2026-11-07', slot: 'dinner' as const } };
    const { off, plain } = leftoversOfChange([dinner, planned, pinned, eaten, other], dinner);
    expect(off).toEqual([planned]);
    expect(plain).toEqual([{ ...pinned, leftoversOf: null }]);
  });
});

describe('when leftovers fit', () => {
  const tue = { date: '2026-11-03', slot: 'dinner' as const };

  it('has to be after the meal, by slot within a day', () => {
    expect(leftoversFit({ date: '2026-11-04', slot: 'lunch' }, tue)).toBe(true);
    expect(leftoversFit({ date: '2026-11-03', slot: 'lunch' }, tue)).toBe(false);
    expect(leftoversFit({ date: '2026-11-03', slot: 'dinner' }, { date: '2026-11-03', slot: 'lunch' })).toBe(true);
    expect(leftoversFit({ date: '2026-11-02', slot: 'dinner' }, tue)).toBe(false);
  });

  it('has to be soon enough', () => {
    expect(leftoversFit({ date: '2026-11-06', slot: 'dinner' }, tue)).toBe(true);
    expect(leftoversFit({ date: '2026-11-07', slot: 'lunch' }, tue)).toBe(false);
  });
});
