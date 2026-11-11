import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './pantry.ts';
import { inWalkingOrder, shopSections, STORE_WALK } from './shop-sections.ts';

const line = (name: string, category: string) => ({ name, category });

describe('the list follows the store', () => {
  it('has a place on the walk for every pantry category', () => {
    expect([...STORE_WALK].sort()).toEqual([...CATEGORIES].sort());
  });

  it('starts at produce, keeps frozen near the end and Other last', () => {
    expect(STORE_WALK[0]).toBe('Produce');
    expect(STORE_WALK.at(-2)).toBe('Frozen');
    expect(STORE_WALK.at(-1)).toBe('Other');
  });

  it('sorts by section, then by name', () => {
    const lines = [line('peas', 'Frozen'), line('tape', 'Other'), line('onions', 'Produce'), line('apples', 'Produce'), line('rice', 'Pantry')];
    expect(inWalkingOrder(lines).map(l => l.name)).toEqual(['apples', 'onions', 'rice', 'peas', 'tape']);
  });

  it('groups into headed sections, leaving out empty ones', () => {
    const sections = shopSections([line('peas', 'Frozen'), line('onions', 'Produce'), line('apples', 'Produce')]);
    expect(sections.map(s => s.category)).toEqual(['Produce', 'Frozen']);
    expect(sections[0].lines.map(l => l.name)).toEqual(['apples', 'onions']);
  });

  it('files a category it doesn’t know under Other', () => {
    expect(shopSections([line('gum', 'Checkout'), line('tape', 'Other')])).toEqual([{ category: 'Other', lines: [line('gum', 'Checkout'), line('tape', 'Other')] }]);
  });
});
