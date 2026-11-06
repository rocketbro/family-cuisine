import { describe, expect, it } from 'vitest';
import { blankEntry } from './plan.ts';
import { bodyWithHeading, ingredientsFromText, ingredientsToText, planWithoutRecipe } from './recipe-edit.ts';

describe('editing a recipe', () => {
  it('round-trips ingredients through the text box, groups and all', () => {
    const text = '2 cups flour, sifted\nFor the sauce:\n1 1/2 tbsp butter\nparsley (optional)';
    const parsed = ingredientsFromText(text);
    expect(parsed.map(i => [i.item, i.group])).toEqual([['flour', null], ['butter', 'For the sauce'], ['parsley', 'For the sauce']]);
    expect(parsed[2].optional).toBe(true);
    expect(ingredientsToText(parsed)).toBe(text);
  });

  it('keeps steps typed without a heading from turning into ingredients', () => {
    expect(bodyWithHeading('1. Mix it.')).toBe('## Steps\n1. Mix it.');
    expect(bodyWithHeading('## Method\n1. Mix it.')).toBe('## Method\n1. Mix it.');
    expect(bodyWithHeading('  ')).toBe('');
  });
});

describe('deleting a recipe', () => {
  const meal = (date: string, slot: 'breakfast' | 'dinner' | 'lunch', extra = {}) => ({ ...blankEntry(date, slot), kind: 'recipe' as const, recipeSlug: 'tacos', ...extra });

  it('takes uneaten meals and their leftovers off the plan', () => {
    const dinner = meal('2026-11-05', 'dinner');
    const leftovers = { ...blankEntry('2026-11-06', 'lunch'), kind: 'leftovers' as const, leftoversOf: { date: '2026-11-05', slot: 'dinner' as const } };
    const other = meal('2026-11-07', 'dinner', { recipeSlug: 'soup' });
    const { removed, renamed } = planWithoutRecipe([dinner, leftovers, other], 'tacos', 'Tacos');
    expect(removed).toEqual([dinner, leftovers]);
    expect(renamed).toEqual([]);
  });

  it('keeps the title on meals already recorded', () => {
    const made = meal('2026-11-03', 'dinner', { outcome: 'made' });
    const swappedTo = meal('2026-11-02', 'dinner', { recipeSlug: 'soup', outcome: 'swapped', outcomeSlug: 'tacos' });
    const skipped = meal('2026-11-01', 'dinner', { outcome: 'skipped' });
    const swappedAway = meal('2026-10-31', 'dinner', { outcome: 'swapped', outcomeSlug: 'soup' });
    const { removed, renamed } = planWithoutRecipe([made, swappedTo, skipped, swappedAway], 'tacos', 'Tacos');
    expect(removed).toEqual([]);
    expect(renamed.map(e => [e.date, e.kind, e.note, e.outcome, e.recipeSlug])).toEqual([
      ['2026-11-03', 'note', 'Tacos', 'made', null],
      ['2026-11-02', 'note', 'Tacos', 'made', null],
      ['2026-11-01', 'note', 'Tacos', 'skipped', null],
    ]);
  });
});
