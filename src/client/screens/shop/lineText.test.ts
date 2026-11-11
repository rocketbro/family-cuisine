import { describe, expect, it } from 'vitest';
import { copyList, lineReason } from './lineText.ts';

const line = (name: string, category: string, packages = 1, quantity: number | null = null) => ({ name, category, packages, quantity });

describe('copying the list', () => {
  it('keeps the sections and the walking order', () => {
    const text = copyList([line('peas', 'Frozen'), line('candles', 'Other'), line('onions', 'Produce', 2), line('apples', 'Produce'), line('eggs', 'Dairy & eggs', 1, 6)]);
    expect(text).toBe('Produce\napples\nonions, buy 2\n\nDairy & eggs\neggs (6)\n\nFrozen\npeas\n\nOther\ncandles');
  });
});

describe('why a line is on the list', () => {
  it('says so in a few words', () => {
    expect(lineReason({ reason: 'restock', neededFor: [] })).toBe('Restock');
    expect(lineReason({ reason: 'added', neededFor: [] })).toBe('Added for this trip');
    expect(lineReason({ reason: 'needed', neededFor: ['Chili', 'Tacos'] })).toBe('Chili, Tacos');
  });
});
