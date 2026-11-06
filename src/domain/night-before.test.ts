import { describe, expect, it } from 'vitest';
import { cleanNightBefore, dueForMeal, dueForRecipe, nightBeforeDue, nightBeforeInTime, nightBeforeLine, nightBeforeRefused, NIGHT_BEFORE_LONGEST } from './night-before.ts';

describe('cleanNightBefore', () => {
  it('keeps a short line of plain words, in one line, with no full stop', () => {
    expect(cleanNightBefore('Soak the beans overnight')).toBe('Soak the beans overnight');
    expect(cleanNightBefore('  Soak the beans\n overnight.  ')).toBe('Soak the beans overnight');
    expect(cleanNightBefore('Rub 1.5 lb brisket with salt (don’t rinse) and chill')).not.toBeNull();
  });

  it.each(['', '   ', 'none', 'N/A', 'No.', 'null', 7, true, null, undefined, ['Soak']])('means no step: %j', value => {
    expect(cleanNightBefore(value)).toBeNull();
  });

  it.each([
    'See https://evil.example/soak', 'Visit evil.com tonight', 'mailto:someone', 'www.soak.now', '[Soak](x)', 'Soak ![a](b)', '<b>Soak</b>',
    '**Soak**', '# Soak', 'Soak `now`', 'Soak‮the beans',
  ])('refuses links and markup: %s', value => {
    expect(cleanNightBefore(value)).toBeNull();
  });

  it('caps the length', () => {
    expect(cleanNightBefore('a'.repeat(NIGHT_BEFORE_LONGEST))).not.toBeNull();
    expect(cleanNightBefore('a'.repeat(NIGHT_BEFORE_LONGEST + 1))).toBeNull();
  });

  it('tells text it refuses from having no step at all', () => {
    expect(nightBeforeRefused('')).toBe(false);
    expect(nightBeforeRefused('  ')).toBe(false);
    expect(nightBeforeRefused('Soak the beans')).toBe(false);
    expect(nightBeforeRefused('see evil.com')).toBe(true);
  });
});

describe('when a step is due', () => {
  const today = '2026-11-08';
  it('is tonight for tomorrow’s meal, and was last night for today’s', () => {
    expect(nightBeforeDue('2026-11-09', today)).toBe('tonight');
    expect(nightBeforeDue(today, today)).toBe('last-night');
    expect(nightBeforeDue('2026-11-10', today)).toBeNull();
    expect(nightBeforeDue('2026-11-07', today)).toBeNull();
    expect(nightBeforeLine('Soak the beans overnight', 'tonight')).toBe('Tonight: Soak the beans overnight');
    expect(nightBeforeLine('Soak the beans overnight', 'last-night')).toBe('Needed last night: Soak the beans overnight');
  });

  const meal = (date: string, extra: Partial<{ kind: string; recipeSlug: string | null; outcome: string | null }> = {}) => ({ date, kind: 'recipe', recipeSlug: 'soup', outcome: null, ...extra });

  it('says nothing for a meal already made, or that isn’t a recipe', () => {
    expect(dueForMeal(meal('2026-11-09'), today)).toBe('tonight');
    expect(dueForMeal(meal('2026-11-09', { outcome: 'made' }), today)).toBeNull();
    expect(dueForMeal(meal('2026-11-09', { kind: 'leftovers' }), today)).toBeNull();
  });

  it('for a recipe, looks at its own meals, and what can still be done wins', () => {
    expect(dueForRecipe([meal(today), meal('2026-11-09')], 'soup', today)).toBe('tonight');
    expect(dueForRecipe([meal(today)], 'soup', today)).toBe('last-night');
    expect(dueForRecipe([meal(today, { recipeSlug: 'stew' })], 'soup', today)).toBeNull();
    expect(dueForRecipe([], 'soup', today)).toBeNull();
  });
});

describe('nightBeforeInTime', () => {
  const today = '2026-11-08';
  const five = 17 * 60;
  it('is too late for today at any hour', () => {
    expect(nightBeforeInTime(today, today, 3 * 60, five)).toBe(false);
  });
  it('allows tomorrow until the reminder time', () => {
    expect(nightBeforeInTime('2026-11-09', today, five - 1, five)).toBe(true);
    expect(nightBeforeInTime('2026-11-09', today, five, five)).toBe(false);
  });
  it('always allows later days', () => {
    expect(nightBeforeInTime('2026-11-10', today, 23 * 60, five)).toBe(true);
  });
});
