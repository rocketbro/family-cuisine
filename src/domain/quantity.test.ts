import { describe, expect, it } from 'vitest';
import { formatAmount, parseAmount } from './quantity.ts';

describe('quantities', () => {
  it('reads the ways people write amounts', () => {
    expect(parseAmount('1 1/2')).toBe(1.5);
    expect(parseAmount('½')).toBe(0.5);
    expect(parseAmount('1½')).toBe(1.5);
    expect(parseAmount('0.25')).toBe(0.25);
  });
  it('writes kitchen fractions', () => {
    expect(formatAmount(1.5)).toBe('1½');
    expect(formatAmount(2 / 3)).toBe('⅔');
    expect(formatAmount(3)).toBe('3');
  });
});
