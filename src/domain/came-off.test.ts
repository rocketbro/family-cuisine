import { describe, expect, it } from 'vitest';
import { cameOffMeal, placedCameOff } from './came-off.ts';
import { blankEntry, type PlanEntry } from './plan.ts';

const DATE = '2026-11-04';
const titleOf = (slug: string) => (slug === 'gone' ? null : slug.toUpperCase());
const tacos = (over: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(DATE, 'dinner'), kind: 'recipe', recipeSlug: 'tacos', multiplier: 2, ...over });
const eatingOut = { ...blankEntry(DATE, 'dinner'), note: 'Eating out', pinned: true };

describe('what came off', () => {
  it('names a recipe nobody made yet, with what belongs to it', () => {
    const drafted = { how: 'Add rice', uses: [] };
    expect(cameOffMeal(tacos({ drafted }), eatingOut, titleOf)).toEqual({ date: DATE, slot: 'dinner', title: 'TACOS', recipeSlug: 'tacos', multiplier: 2, drafted });
  });

  it('says nothing when there’s nothing worth moving', () => {
    expect(cameOffMeal(null, eatingOut, titleOf)).toBeNull();
    expect(cameOffMeal({ ...eatingOut, note: 'Burgers' }, eatingOut, titleOf)).toBeNull();
    expect(cameOffMeal(tacos({ outcome: 'made' }), eatingOut, titleOf)).toBeNull();
    expect(cameOffMeal(tacos({ recipeSlug: 'gone' }), eatingOut, titleOf)).toBeNull();
  });

  it('says nothing when it’s the same dish at another size', () => {
    expect(cameOffMeal(tacos(), tacos({ multiplier: 1 }), titleOf)).toBeNull();
  });

  it('goes on its new day pinned, whole', () => {
    const drafted = { how: 'Add rice', uses: [] };
    const placed = placedCameOff(cameOffMeal(tacos({ drafted }), eatingOut, titleOf)!, '2026-11-05');
    expect(placed).toMatchObject({ date: '2026-11-05', slot: 'dinner', kind: 'recipe', recipeSlug: 'tacos', multiplier: 2, drafted, pinned: true, outcome: null });
  });
});
