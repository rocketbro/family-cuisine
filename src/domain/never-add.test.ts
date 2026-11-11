import { describe, expect, it } from 'vitest';
import { isNeverAdded, withNeverAdded } from './never-add.ts';

const eraser = { id: 1, printed: 'Mr. Clean Magic Eraser Original, 4 Count', name: 'Magic Eraser' };

describe('never adding a product', () => {
  it('knows it again by its printed words or its name, whatever the punctuation or plural', () => {
    expect(isNeverAdded({ printed: 'MR CLEAN MAGIC ERASER ORIGINAL 4 COUNT', name: 'cleaning pads' }, [eraser])).toBe(true);
    expect(isNeverAdded({ printed: 'Something else entirely', name: 'magic erasers' }, [eraser])).toBe(true);
  });

  it('never takes a longer or shorter product with it', () => {
    expect(isNeverAdded({ printed: 'Mr. Clean Magic Eraser Bath Scrubber', name: 'Magic Eraser bath scrubber' }, [eraser])).toBe(false);
    expect(isNeverAdded({ printed: 'Magic', name: 'Eraser' }, [eraser])).toBe(false);
    expect(isNeverAdded({ printed: 'Great Value Large White Eggs 18 Count', name: 'eggs' }, [eraser])).toBe(false);
  });

  it('ignores empty words rather than matching everything', () => {
    expect(isNeverAdded({ printed: '', name: '!!' }, [{ id: 1, printed: '', name: '' }])).toBe(false);
  });

  it('adds each product once, with its own id', () => {
    const list = withNeverAdded([eraser], [{ printed: eraser.printed, name: 'Magic eraser' }, { printed: 'Dawn Dish Soap 19 oz', name: 'dish soap' }]);
    expect(list).toEqual([eraser, { id: 2, printed: 'Dawn Dish Soap 19 oz', name: 'dish soap' }]);
  });
});
