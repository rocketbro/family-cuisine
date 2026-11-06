import { describe, expect, it, vi } from 'vitest';
import type { RecipeForm } from '../../domain/recipe-form.ts';
import type { SaidRevision } from '../../domain/recipe-revision.ts';
import type { Deps } from './deps.ts';
import { reviseRecipe } from './revise-recipe.ts';
import { UserError } from './user-error.ts';

const form: RecipeForm = {
  title: 'Soup', meals: ['dinner'], serves: '4', time: '', nightBefore: '', summary: 'A soup.',
  ingredients: '3 cloves garlic\n1 cup cream', body: '## Steps\n1. Add the cream.',
};
const answer: SaidRevision = {
  understood: true, note: ' Doubled the garlic. ', title: 'Soup', meals: ['dinner'], serves: 4, time: '1 hr', nightBefore: null, summary: 'A soup.',
  ingredients: ['6 cloves garlic', '1 cup milk'], body: '## Steps\n1. Add the milk.',
};

function setup(said: SaidRevision = answer, { available = true, exists = true } = {}) {
  const ask = vi.fn(async () => said);
  const update = vi.fn();
  const deps = {
    ai: { available: () => available, reviseRecipe: ask },
    recipes: { get: () => (exists ? { slug: 'soup', title: 'The saved title', ingredients: [] } : null), update },
    pantry: { list: () => [{ name: 'milk' }, { name: 'garlic' }] },
    log: vi.fn(),
  } as unknown as Deps;
  return { deps, ask, update };
}

const rejection = (run: Promise<unknown>) => run.then(() => { throw new Error('expected a refusal'); }, (e: unknown) => e as UserError);

describe('reviseRecipe', () => {
  it('returns the changed form and what Claude says it did', async () => {
    const { deps } = setup();
    await expect(reviseRecipe(deps, 'soup', { said: 'double the garlic', form })).resolves.toEqual({
      note: 'Doubled the garlic.',
      form: { ...form, time: '1 hr', ingredients: '6 cloves garlic\n1 cup milk', body: '## Steps\n1. Add the milk.' },
    });
  });

  it('works on what the form holds, not the saved recipe', async () => {
    const { deps, ask } = setup();
    const typed = { ...form, title: 'Typed by hand', ingredients: '3 cloves garlic\n1 cup cream\na good pinch of love' };
    await reviseRecipe(deps, 'soup', { said: ' double the garlic ', form: typed });
    expect(ask).toHaveBeenCalledWith({ said: 'double the garlic', form: typed, pantryNames: ['milk', 'garlic'] });
  });

  it('saves nothing', async () => {
    const { deps, update } = setup();
    await reviseRecipe(deps, 'soup', { said: 'double the garlic', form });
    expect(update).not.toHaveBeenCalled();
  });

  it('passes on what Claude couldn’t understand, in its own plain words', async () => {
    const { deps } = setup({ ...answer, understood: false, note: 'I heard “blue Tuesday” and couldn’t tell what to change.' });
    const error = await rejection(reviseRecipe(deps, 'soup', { said: 'blue Tuesday', form }));
    expect(error).toBeInstanceOf(UserError);
    expect(error.message).toContain('blue Tuesday');
    expect(error.status).toBe(422);
  });

  it('still says something when Claude gives no reason', async () => {
    const { deps } = setup({ ...answer, understood: false, note: ' ' });
    expect((await rejection(reviseRecipe(deps, 'soup', { said: 'hm', form }))).message).toContain('nothing changed');
  });

  it('refuses an answer that doesn’t fit, in words a person can read', async () => {
    const { deps } = setup({ ...answer, ingredients: ['a splash of milk'] });
    const error = await rejection(reviseRecipe(deps, 'soup', { said: 'use milk', form }));
    expect(error).toBeInstanceOf(UserError);
    expect(error.message).toContain('“a splash of milk”');
    expect(error.message).toContain('nothing changed');
  });

  it('asks nothing with no key, no recipe or no words', async () => {
    const noKey = setup(answer, { available: false });
    const error = await rejection(reviseRecipe(noKey.deps, 'soup', { said: 'x', form }));
    expect(error.message).toContain('Anthropic API key');
    expect(error.status).toBe(503);
    expect(noKey.ask).not.toHaveBeenCalled();

    const gone = setup(answer, { exists: false });
    expect((await rejection(reviseRecipe(gone.deps, 'soup', { said: 'x', form }))).status).toBe(404);
    expect(gone.ask).not.toHaveBeenCalled();

    const silent = setup();
    expect((await rejection(reviseRecipe(silent.deps, 'soup', { said: '  ', form }))).message).toContain('didn’t catch');
    expect(silent.ask).not.toHaveBeenCalled();
  });
});
