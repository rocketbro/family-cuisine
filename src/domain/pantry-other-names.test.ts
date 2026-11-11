import { describe, expect, it } from 'vitest';
import { matchesInRecipe, newOtherNames } from './pantry-other-names.ts';
import { pantryItem } from './test-fixtures.ts';

const discard = pantryItem(1, 'sourdough discard', { staple: true });
const pantry = [discard, pantryItem(2, 'eggs'), pantryItem(3, 'butter'), pantryItem(4, 'margarine', { alsoCalled: ['spread'] })];

describe('newOtherNames', () => {
  it('adds the name a recipe used when it differs from the pantry item', () => {
    expect(newOtherNames([{ written: 'sourdough starter', pantryName: 'sourdough discard' }], pantry)).toEqual([{ itemId: 1, alsoCalled: ['sourdough starter'] }]);
  });

  it('compares normalized, so case, plurals and punctuation make no difference', () => {
    const named = [pantryItem(1, 'Sourdough Discard', { alsoCalled: ['Starters'] })];
    expect(newOtherNames([{ written: 'sourdough discard', pantryName: 'SOURDOUGH DISCARD' }, { written: 'starter', pantryName: 'sourdough discard' }], named)).toEqual([]);
  });

  it('adds a name once, after the item’s own others and across repeats', () => {
    const called = [pantryItem(1, 'sourdough discard', { alsoCalled: ['levain'] })];
    const matches = [{ written: 'Sourdough starter', pantryName: 'sourdough discard' }, { written: 'sourdough starters', pantryName: 'sourdough discard' }, { written: 'Levain', pantryName: 'sourdough discard' }];
    expect(newOtherNames(matches, called)).toEqual([{ itemId: 1, alsoCalled: ['levain', 'Sourdough starter'] }]);
  });

  it('ignores names for things not in the pantry and blank names', () => {
    expect(newOtherNames([{ written: 'starter', pantryName: 'nonsense' }, { written: '  ', pantryName: 'eggs' }], pantry)).toEqual([]);
  });

  it('skips a name with the item’s own name inside it', () => {
    expect(newOtherNames([{ written: 'large eggs', pantryName: 'eggs' }, { written: 'butter sticks', pantryName: 'butter' }], pantry)).toEqual([]);
  });

  it('skips a name that offers a choice', () => {
    expect(newOtherNames([{ written: 'mirin or rice wine', pantryName: 'sourdough discard' }], pantry)).toEqual([]);
  });

  it('never takes a name that belongs to another pantry item', () => {
    expect(newOtherNames([{ written: 'butter', pantryName: 'margarine' }, { written: 'spread', pantryName: 'butter' }], pantry)).toEqual([]);
  });
});

describe('matchesInRecipe', () => {
  it('keeps only matches for ingredients the recipe has', () => {
    const matches = [{ written: 'Sourdough starter', pantryName: 'sourdough discard' }, { written: 'ghost', pantryName: 'eggs' }];
    expect(matchesInRecipe(matches, ['sourdough starters', 'flour'])).toEqual([matches[0]]);
  });
});
