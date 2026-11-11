import { describe, expect, it } from 'vitest';
import { hasSeen, markSeen } from './tip-memory.ts';
import { TIPS } from './tips.ts';

function fakeStore(initial: string | null = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
    removeItem: () => { value = null; },
    peek: () => value,
  };
}

describe('tip memory', () => {
  it('shows a tip until it has been seen', () => {
    const store = fakeStore();
    expect(hasSeen('pantry', store)).toBe(false);
    markSeen('pantry', store);
    expect(hasSeen('pantry', store)).toBe(true);
    expect(hasSeen('list', store)).toBe(false);
  });

  it('shows a tip again when its version goes up', () => {
    const store = fakeStore(JSON.stringify({ pantry: TIPS.pantry.version - 1 }));
    expect(hasSeen('pantry', store)).toBe(false);
  });

  it('starts over from a damaged value', () => {
    const store = fakeStore('not json');
    expect(hasSeen('today', store)).toBe(false);
    markSeen('today', store);
    expect(hasSeen('today', store)).toBe(true);
  });
});
