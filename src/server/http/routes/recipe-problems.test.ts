// Through the whole app with the real file repository, because what matters here is what comes
// out of a real folder of odd files.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeDeps } from '../../application/test-support/full-deps-fake.ts';
import { fileRecipeRepository } from '../../infrastructure/recipes/file-recipe-repository.ts';
import { createApp } from '../app.ts';

const GOOD = '---\ntitle: Soup\nmeals: [dinner]\n---\n\n## Ingredients\n- 1 onion\n';
const trust = { hostnames: new Set(['localhost']), publicOrigin: null };
const MARK = '__cuisine_ran_a_recipe_header';

let dir: string;
let clientDir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-problems-'));
  clientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-client-'));
  fs.writeFileSync(path.join(clientDir, 'index.html'), '<!doctype html>');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(clientDir, { recursive: true, force: true });
  delete (globalThis as Record<string, unknown>)[MARK];
});

async function problems(files: Record<string, string>) {
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  const deps = fakeDeps();
  deps.recipes = fileRecipeRepository(dir, () => undefined);
  const app = createApp(deps, { clientDir, trust, accessToken: null });
  const response = await app.request('/api/recipe-problems', { headers: { host: 'localhost' } });
  expect(response.status).toBe(200);
  return { body: await response.text(), deps };
}

describe('GET /api/recipe-problems', () => {
  it('is empty when every file reads', async () => {
    expect(JSON.parse((await problems({ 'soup.md': GOOD })).body)).toEqual([]);
  });

  it('names the file and what’s wrong in plain words', async () => {
    const { body } = await problems({ 'soup.md': GOOD, 'taco-night.md': '---\ntitle: "Tacos\nmeals: [dinner\n---\n\nBody\n' });
    expect(JSON.parse(body)).toEqual([{ file: 'taco-night.md', problem: 'the header has a typo' }]);
  });

  it('shows a refused ---js file without running it', async () => {
    const code = `{ title: (globalThis.${MARK} = 'yes') }`;
    const { body } = await problems({ 'sneaky.md': `---js\n${code}\n---\n\nBody\n` });
    expect(JSON.parse(body)).toEqual([{ file: 'sneaky.md', problem: expect.stringContaining('plain fields') }]);
    expect((globalThis as Record<string, unknown>)[MARK]).toBeUndefined();
    expect(body).not.toContain(MARK);
  });

  it('never gives out a path, even when the file system’s error has one', async () => {
    fs.mkdirSync(path.join(dir, 'folder.md'));
    const { body } = await problems({});
    expect(JSON.parse(body)).toEqual([{ file: 'folder.md', problem: 'the file couldn’t be opened' }]);
    expect(body).not.toContain(dir);
    expect(body).not.toContain(os.tmpdir());
  });

  it('never quotes the file itself', async () => {
    const { body } = await problems({ 'leaky.md': '---\nsecret_family_detail: "oops\n---\n' });
    expect(body).not.toContain('secret_family_detail');
  });

  it('hands back an odd file name as data, with its invisible characters gone', async () => {
    const name = '<img src=x onerror=alert(1)>‮.md';
    const { body } = await problems({ [name]: GOOD });
    expect(JSON.parse(body)).toEqual([{ file: '<img src=x onerror=alert(1)>.md', problem: expect.stringContaining('file names') }]);
  });

  it('leaves the files exactly as they are', async () => {
    const text = '---\ntitle: "Tacos\n---\n';
    await problems({ 'taco-night.md': text });
    expect(fs.readFileSync(path.join(dir, 'taco-night.md'), 'utf8')).toBe(text);
  });

  it('lets a recipe called Problems keep its own address', async () => {
    const { deps } = await problems({ 'problems.md': GOOD });
    const app = createApp(deps, { clientDir, trust, accessToken: null });
    const response = await app.request('/api/recipes/problems', { headers: { host: 'localhost' } });
    expect(response.status).toBe(200);
  });
});
