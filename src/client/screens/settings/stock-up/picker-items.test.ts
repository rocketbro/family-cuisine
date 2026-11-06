import { describe, expect, it } from 'vitest';
import { pantryItem } from '../../../../domain/test-fixtures.ts';
import { matchingItems } from './picker-items.ts';

describe('searching the pantry for something to stock up', () => {
  const items = [pantryItem(1, 'tuna'), pantryItem(2, 'ground beef', { alsoCalled: ['hamburger'] }), pantryItem(3, 'Chicken thighs')];
  const names = (query: string) => matchingItems(items, query).map(i => i.name);

  it('shows everything in name order until there is a search', () => {
    expect(names('')).toEqual(['Chicken thighs', 'ground beef', 'tuna']);
  });
  it('finds part of a name, in any case', () => {
    expect(names('CHICK')).toEqual(['Chicken thighs']);
  });
  it('finds what an item is also called', () => {
    expect(names('hamburger')).toEqual(['ground beef']);
  });
  it('finds nothing for something that is not in the pantry', () => {
    expect(names('salmon')).toEqual([]);
  });
});
