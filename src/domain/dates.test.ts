import { describe, expect, it } from 'vitest';
import { isRealDate, realDateOrNull } from './dates.ts';

describe('isRealDate', () => {
  it('takes dates that exist, leap days included', () => {
    expect(isRealDate('2026-11-08')).toBe(true);
    expect(isRealDate('2028-02-29')).toBe(true);
  });

  it.each(['2026-99-01', '2026-13-01', '2026-00-10', '2026-11-00', '2026-11-31', '2026-02-29', '2026-1-1', '2026-11-08T00:00', 'soon'])('refuses %s', date => {
    expect(isRealDate(date)).toBe(false);
  });
});

describe('realDateOrNull', () => {
  it('keeps a date that exists', () => {
    expect(realDateOrNull('2026-11-08')).toBe('2026-11-08');
  });

  it.each(['2026-02-30', 'soon', '', null, undefined])('turns %s into null', date => {
    expect(realDateOrNull(date)).toBeNull();
  });
});
