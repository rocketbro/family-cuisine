import { describe, expect, it } from 'vitest';
import { parseIngredientLine } from '../../domain/ingredient.ts';
import { pantryItem } from '../../domain/test-fixtures.ts';
import type { RecipeDraft } from './ports/recipes.ts';
import { editRecipe, importFromWords } from './recipes.ts';
import { fakeDeps } from './test-support/full-deps-fake.ts';

const lines = ['1 cup sourdough starter', '2 cups flour'];
const draft = (matches: RecipeDraft['pantryMatches']): RecipeDraft => ({
  title: 'Bread', kind: 'recipe', meals: ['dinner'], serves: 4, time: null, tags: [], batch: false, seasons: [], source: null, image: null,
  summary: '', ingredients: lines.map(line => parseIngredientLine(line)!), steps: [], notes: null, pantryMatches: matches,
});

function setup(matches: RecipeDraft['pantryMatches']) {
  const deps = fakeDeps({ pantry: [pantryItem(1, 'sourdough discard', { staple: true }), pantryItem(2, 'flour')] });
  deps.ai = { ...deps.ai, available: () => true, recipeFromDescription: async () => draft(matches) };
  deps.recipes.save = () => 'bread';
  return deps;
}

describe('other names from a saved recipe', () => {
  it('adds the name an import used to the pantry item the model matched', async () => {
    const deps = setup([{ written: 'sourdough starter', pantryName: 'sourdough discard' }, { written: 'flour', pantryName: 'flour' }]);
    await importFromWords(deps, 'bread');
    expect(deps.pantry.get(1)?.alsoCalled).toEqual(['sourdough starter']);
    expect(deps.pantry.get(2)?.alsoCalled).toEqual([]);
  });

  it('ignores a match for an unknown pantry name or an ingredient the recipe doesn’t have', async () => {
    const deps = setup([{ written: 'sourdough starter', pantryName: 'no such item' }, { written: 'ghost', pantryName: 'flour' }]);
    await importFromWords(deps, 'bread');
    expect(deps.pantry.list().flatMap(p => p.alsoCalled)).toEqual([]);
  });

  it('adds nothing twice when the same recipe is imported again', async () => {
    const deps = setup([{ written: 'sourdough starter', pantryName: 'sourdough discard' }]);
    await importFromWords(deps, 'bread');
    await importFromWords(deps, 'bread');
    expect(deps.pantry.get(1)?.alsoCalled).toEqual(['sourdough starter']);
  });

  it('does the same when a revised recipe is saved, from the matches that came with it', () => {
    const deps = setup(undefined);
    deps.recipes.get = () => ({ slug: 'bread', nightBefore: null }) as ReturnType<typeof deps.recipes.get>;
    deps.recipes.update = () => undefined;
    editRecipe(deps, 'bread', {
      title: 'Bread', meals: ['dinner'], serves: 4, time: null, summary: '', body: '', ingredients: lines.join('\n'),
      pantryMatches: [{ written: 'sourdough starter', pantryName: 'sourdough discard' }],
    });
    expect(deps.pantry.get(1)?.alsoCalled).toEqual(['sourdough starter']);
  });
});
