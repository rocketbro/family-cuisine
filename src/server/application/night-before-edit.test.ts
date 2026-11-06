// Changing a recipe's night-before step by hand, through the real files.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { fileRecipeRepository } from '../infrastructure/recipes/file-recipe-repository.ts';
import type { Deps } from './deps.ts';
import { editRecipe, type RecipeChanges } from './recipes.ts';
import { UserError } from './user-error.ts';

let dir: string;
let deps: Deps;
const form: RecipeChanges = { title: 'Beans', meals: ['dinner'], serves: 4, time: null, summary: '', ingredients: '1 lb dry beans', body: '' };
const write = (nightBefore: string | null) => fs.writeFileSync(path.join(dir, 'beans.md'), `---\ntitle: Beans\n${nightBefore === null ? '' : `night_before: ${nightBefore}\n`}---\n\n## Ingredients\n- 1 lb dry beans\n`);
const file = () => fs.readFileSync(path.join(dir, 'beans.md'), 'utf8');

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'night-before-edit-'));
  deps = { recipes: fileRecipeRepository(dir, () => undefined) } as unknown as Deps;
});

describe('editing the step', () => {
  it('sets it, tidied', () => {
    write(null);
    editRecipe(deps, 'beans', { ...form, nightBefore: ' Soak the beans overnight. ' });
    expect(deps.recipes.get('beans')?.nightBefore).toBe('Soak the beans overnight');
  });

  it('clears it', () => {
    write('Soak the beans');
    editRecipe(deps, 'beans', { ...form, nightBefore: '' });
    expect(deps.recipes.get('beans')?.nightBefore).toBeNull();
    expect(file()).not.toContain('night_before');
  });

  it('leaves it alone for a page that doesn’t know about it', () => {
    write('Soak the beans');
    editRecipe(deps, 'beans', form);
    expect(deps.recipes.get('beans')?.nightBefore).toBe('Soak the beans');
  });

  it('refuses a link, with words a person can read, and saves nothing', () => {
    write('Soak the beans');
    const before = file();
    expect(() => editRecipe(deps, 'beans', { ...form, nightBefore: 'see https://evil.example' })).toThrow(UserError);
    expect(file()).toBe(before);
  });

  it('keeps a hand-written line too long to show when saving something else', () => {
    const long = 'a'.repeat(200);
    write(long);
    expect(deps.recipes.get('beans')?.nightBefore).toBeNull();
    editRecipe(deps, 'beans', { ...form, title: 'Better beans', nightBefore: null });
    expect(file()).toContain(long);
  });
});
