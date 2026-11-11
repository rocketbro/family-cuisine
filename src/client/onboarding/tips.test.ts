import { describe, expect, it } from 'vitest';
import { tipForPath } from './tip-route.ts';
import { TIPS } from './tips.ts';

describe('tip copy', () => {
  it('keeps every tip short: a title and two to four one-line bullets', () => {
    for (const [id, tip] of Object.entries(TIPS)) {
      expect(tip.title.length, id).toBeGreaterThan(0);
      expect(tip.bullets.length, id).toBeGreaterThanOrEqual(2);
      expect(tip.bullets.length, id).toBeLessThanOrEqual(4);
      for (const bullet of tip.bullets) expect(bullet.length, `${id}: ${bullet}`).toBeLessThanOrEqual(95);
    }
  });
});

describe('which screen shows which tip', () => {
  it('maps the tabs and their important screens', () => {
    expect(tipForPath('/')).toBe('today');
    expect(tipForPath('/day/2026-11-10')).toBe('today');
    expect(tipForPath('/week')).toBe('plan');
    expect(tipForPath('/week/import')).toBe('plan-import');
    expect(tipForPath('/shop')).toBe('list');
    expect(tipForPath('/shop/receipts/4')).toBe('receipt');
    expect(tipForPath('/pantry')).toBe('pantry');
    expect(tipForPath('/recipes')).toBe('recipes');
    expect(tipForPath('/recipes/import')).toBe('recipe-import');
    expect(tipForPath('/recipes/some-soup')).toBe('recipe');
    expect(tipForPath('/checkin/2026-11-10')).toBe('checkin');
    expect(tipForPath('/settings/cooking')).toBe('how-we-cook');
  });

  it('leaves everything else alone', () => {
    expect(tipForPath('/settings')).toBeNull();
    expect(tipForPath('/settings/household')).toBeNull();
    expect(tipForPath('/shop/trip/2026-11-12')).toBeNull();
  });
});
