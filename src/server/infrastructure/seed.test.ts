import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PantryInput } from '../application/ports/pantry.ts';
import { fileRecipeRepository } from './recipes/file-recipe-repository.ts';
import { seedFirstRun } from './seed.ts';

const SEED = path.resolve(import.meta.dirname, '..', '..', '..', 'seed');

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-seed-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function install(start: { pantry?: string[]; recipeFile?: boolean; planned?: boolean } = {}) {
  const pantry = (start.pantry ?? []).map(name => ({ name })) as { name: string }[];
  const settings = new Map<string, string>();
  const recipesDir = path.join(dir, 'recipes');
  const recipes = fileRecipeRepository(recipesDir, () => undefined);
  if (start.recipeFile) fs.writeFileSync(path.join(recipesDir, 'ours.md'), '---\ntitle: Ours\nmeals: [dinner]\n---\n\n## Ingredients\n\n- 1 onion\n');
  const run = () => seedFirstRun({
    seedDir: SEED, recipesDir, recipes,
    pantry: { list: () => pantry as never, create: (item: PantryInput) => { pantry.push(item); return item as never; } },
    plan: { range: () => (start.planned ? [{}] : []) as never },
    household: { setting: key => settings.get(key) ?? null, saveSetting: (key, value) => void (value === null ? settings.delete(key) : settings.set(key, value)) },
    log: () => undefined,
  });
  return { run, pantry, recipes, recipesDir };
}

describe('the first run', () => {
  it('adds staples and starter recipes that read, and no invented stock', () => {
    const app = install();
    app.run();
    expect(app.pantry.map(p => p.name).sort()).toEqual(['salt', 'water']);
    const recipes = app.recipes.list();
    expect(recipes.length).toBeGreaterThanOrEqual(5);
    for (const recipe of recipes) expect(recipe.ingredients.length, recipe.slug).toBeGreaterThan(0);
    for (const slot of ['breakfast', 'lunch', 'dinner'] as const) expect(recipes.some(r => r.meals.includes(slot)), slot).toBe(true);
  });

  it('never runs again, even when everything has been emptied', () => {
    const app = install();
    app.run();
    app.pantry.length = 0;
    for (const file of fs.readdirSync(app.recipesDir)) fs.rmSync(path.join(app.recipesDir, file));
    app.run();
    expect(app.pantry).toEqual([]);
    expect(fs.readdirSync(app.recipesDir)).toEqual([]);
  });
});

describe('an install already in use, from before the marker existed', () => {
  const untouched = (app: ReturnType<typeof install>, pantry: string[], files: string[]) => {
    app.run();
    expect(app.pantry.map(p => p.name)).toEqual(pantry);
    expect(fs.readdirSync(app.recipesDir)).toEqual(files);
  };
  it('is left alone when it has a pantry', () => untouched(install({ pantry: ['eggs'] }), ['eggs'], []));
  it('is left alone when it has only recipes', () => untouched(install({ recipeFile: true }), [], ['ours.md']));
  it('is left alone when it has only a plan', () => untouched(install({ planned: true }), [], []));
  it('stays left alone after its pantry is emptied later', () => {
    const app = install({ pantry: ['eggs'] });
    app.run();
    app.pantry.length = 0;
    app.run();
    expect(app.pantry).toEqual([]);
    expect(fs.readdirSync(app.recipesDir)).toEqual([]);
  });
});
