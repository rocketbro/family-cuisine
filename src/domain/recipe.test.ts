import { describe, expect, it } from 'vitest';
import { parseRecipeBody } from './recipe.ts';

describe('recipe body', () => {
  it('reads grouped ingredients and keeps the rest as markdown', () => {
    const body = parseRecipeBody('Cozy.\n\n## Ingredients\n### For the stock\n- 2 lb chicken thighs\n### For the soup\n- 8 oz egg noodles\n\n## Steps\n1. Simmer.');
    expect(body.summary).toBe('Cozy.');
    expect(body.ingredients.map(i => i.group)).toEqual(['For the stock', 'For the soup']);
    expect(body.body).toContain('## Steps');
  });
});
