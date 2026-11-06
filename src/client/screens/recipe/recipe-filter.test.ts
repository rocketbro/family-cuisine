import { describe, expect, it } from 'vitest';
import { recipeShows } from './recipe-filter.ts';

const ours = { title: 'Taco Night', tags: ['mexican'], meals: ['dinner' as const], claudesPick: false, availability: { level: 'ready' } };
const pick = { ...ours, title: 'Pepper Skillet', claudesPick: true };
const everything = { query: '', filter: 'all' as const, claude: 'show' as const };

describe('recipeShows', () => {
  it('finds extras under their own filter, and a dish that is both under each', () => {
    const cake = { ...ours, title: 'Carrot Cake', meals: ['extra' as const] };
    const muffins = { ...ours, title: 'Muffins', meals: ['breakfast' as const, 'extra' as const] };
    expect(recipeShows(cake, { ...everything, filter: 'extra' })).toBe(true);
    expect(recipeShows(cake, { ...everything, filter: 'dinner' })).toBe(false);
    expect(recipeShows(muffins, { ...everything, filter: 'extra' })).toBe(true);
    expect(recipeShows(muffins, { ...everything, filter: 'breakfast' })).toBe(true);
    expect(recipeShows(ours, { ...everything, filter: 'extra' })).toBe(false);
  });

  it('includes Claude’s picks with the rest until told otherwise', () => {
    expect(recipeShows(pick, everything)).toBe(true);
    expect(recipeShows(ours, everything)).toBe(true);
  });

  it('can hide Claude’s picks, under any other filter too', () => {
    for (const filter of ['all', 'ready', 'dinner'] as const) {
      expect(recipeShows(pick, { ...everything, filter, claude: 'hide' })).toBe(false);
      expect(recipeShows(ours, { ...everything, filter, claude: 'hide' })).toBe(true);
    }
  });

  it('can show only Claude’s picks, and still narrow them down', () => {
    expect(recipeShows(pick, { ...everything, claude: 'only' })).toBe(true);
    expect(recipeShows(ours, { ...everything, claude: 'only' })).toBe(false);
    expect(recipeShows(pick, { ...everything, claude: 'only', filter: 'breakfast' })).toBe(false);
  });

  it('searches titles and tags, whatever the case', () => {
    expect(recipeShows(ours, { ...everything, query: 'TACO' })).toBe(true);
    expect(recipeShows(ours, { ...everything, query: 'mexican' })).toBe(true);
    expect(recipeShows(ours, { ...everything, query: 'soup' })).toBe(false);
  });
});
