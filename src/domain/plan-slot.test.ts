import { describe, expect, it } from 'vitest';
import { checkinNotice } from './checkin-notice.ts';
import { extraId, extraSlot, isExtraSlot, isPlanSlot, slotLabel, slotWord } from './plan-slot.ts';

describe('plan slots', () => {
  it('knows an extra from a meal, and anything else from both', () => {
    expect(isExtraSlot('extra-12')).toBe(true);
    expect(isExtraSlot('dinner')).toBe(false);
    for (const bad of ['extra-0', 'extra-', 'extra-1;', 'extra-01', 'brunch', '']) expect(isPlanSlot(bad)).toBe(false);
    expect(isPlanSlot('lunch')).toBe(true);
  });

  it('goes to and from its id', () => {
    expect(extraId(extraSlot(42))).toBe(42);
  });

  it('reads as words', () => {
    expect(slotLabel('dinner')).toBe('Dinner');
    expect(slotLabel('extra-3')).toBe('Extra');
    expect(slotWord('extra-3')).toBe('extra');
  });
});

describe('the check-in notification', () => {
  it('says what it always did with no extras', () => {
    expect(checkinNotice([]).body).toBe('Tell us what you ate, and we’ll keep the pantry right.');
  });

  it('asks about extras by name', () => {
    expect(checkinNotice(['Birthday cake']).body).toContain('whether you made Birthday cake,');
    expect(checkinNotice(['A', 'B', 'C']).body).toContain('A, B and C,');
  });
});
