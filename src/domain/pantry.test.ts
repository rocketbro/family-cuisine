import { describe, expect, it } from 'vitest';
import { findPantryItem, parseWalmartItemId } from './pantry.ts';
import { pantryItem } from './test-fixtures.ts';

describe('pantry matching', () => {
  const pantry = [pantryItem(1, 'Eggs', { count: 12 }), pantryItem(2, 'Flour'), pantryItem(3, 'Bread flour')];
  it('prefers the most specific name', () => {
    expect(findPantryItem('large eggs', pantry)?.id).toBe(1);
    expect(findPantryItem('all-purpose flour', pantry)?.id).toBe(2);
    expect(findPantryItem('bread flour', pantry)?.id).toBe(3);
    expect(findPantryItem('celery', pantry)).toBeNull();
  });
  it('reads Walmart IDs from links', () => {
    expect(parseWalmartItemId('https://www.walmart.com/ip/Jif-Creamy/10314928?x=1')).toBe('10314928');
    expect(parseWalmartItemId('10314928')).toBe('10314928');
  });
});

describe('choosing a pantry item', () => {
  const pantry = ['flour', 'einkorn all-purpose flour', 'dark brown sugar', 'light brown sugar', 'potatoes', 'sweet potatoes'].map((name, i) => pantryItem(i + 1, name, name === 'light brown sugar' ? { alsoCalled: ['brown sugar'] } : {}));
  const find = (name: string) => findPantryItem(name, pantry)?.name;
  it('never takes a particular kind when the plain one is there', () => {
    expect(find('all-purpose flour')).toBe('flour');
    expect(find('einkorn all-purpose flour')).toBe('einkorn all-purpose flour');
  });
  it('reads brown sugar as light unless the recipe says dark', () => {
    expect(find('brown sugar')).toBe('light brown sugar');
    expect(find('dark brown sugar')).toBe('dark brown sugar');
    expect(findPantryItem('brown sugar', [pantryItem(1, 'dark brown sugar')])?.name).toBe('dark brown sugar');
  });
  it('reads chicken broth concentrate as chicken broth', () => {
    expect(findPantryItem('chicken broth concentrate', [pantryItem(1, 'chicken broth', { alsoCalled: ['chicken broth concentrate'] })])?.name).toBe('chicken broth');
  });
  it('keeps potatoes and sweet potatoes apart', () => {
    expect(find('russet potatoes')).toBe('potatoes');
    expect(find('sweet potatoes')).toBe('sweet potatoes');
  });
});

describe('what a pantry item is also called', () => {
  const spread = (id: number, name: string, status: 'have' | 'low' | 'out') => pantryItem(id, name, { status, alsoCalled: ['jam', 'jelly', 'preserves', 'fruit spread'] });

  it('finds jam whatever the jar says', () => {
    expect(findPantryItem('jam', [spread(1, 'raspberry preserves', 'low')])?.name).toBe('raspberry preserves');
    expect(findPantryItem('jelly', [spread(1, 'raspberry preserves', 'have')])?.name).toBe('raspberry preserves');
  });

  it('takes what is in the house over what ran out', () => {
    const pantry = [spread(1, 'grape jelly', 'out'), spread(2, 'strawberry jelly', 'out'), spread(3, 'raspberry preserves', 'low')];
    expect(findPantryItem('jam', pantry)?.name).toBe('raspberry preserves');
    expect(findPantryItem('jelly', pantry)?.name).toBe('raspberry preserves');
    expect(findPantryItem('grape jelly', pantry)?.name).toBe('raspberry preserves');
  });

  it('prefers the closest wording when several are in the house', () => {
    const pantry = [spread(1, 'blackberry fruit spread', 'have'), spread(2, 'strawberry jelly', 'have')];
    expect(findPantryItem('strawberry jam', pantry)?.name).toBe('strawberry jelly');
  });

  it('does not stand in for a different thing with a similar name', () => {
    const pantry = [pantryItem(1, 'peanut butter'), pantryItem(2, 'butter', { status: 'out' })];
    expect(findPantryItem('butter', pantry)?.name).toBe('butter');
  });

  it('picks a kind that is in stock when a recipe just says the plain name', () => {
    const pantry = [pantryItem(1, 'red bell peppers', { status: 'out' }), pantryItem(2, 'green bell peppers')];
    expect(findPantryItem('bell peppers', pantry)?.name).toBe('green bell peppers');
    expect(findPantryItem('bread', [pantryItem(3, 'whole wheat sliced bread', { status: 'low' })])?.name).toBe('whole wheat sliced bread');
  });
});
