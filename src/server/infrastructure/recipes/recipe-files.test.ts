import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecipeEdit } from '../../../domain/recipe-edit.ts';
import { parseIngredientLine, type Ingredient } from '../../../domain/ingredient.ts';
import type { RecipeImage } from '../../../domain/recipe.ts';
import type { RecipeDraft, RecipeRepository } from '../../application/ports/recipes.ts';
import { fileRecipeRepository } from './file-recipe-repository.ts';
import { parseRecipeFile, withEdit, withImage, withoutPick, withSeasons } from './recipe-markdown.ts';

const PHOTO: RecipeImage = { kind: 'photo', file: 'soup-1.webp' };
const flour = parseIngredientLine('- 2 cups flour') as Ingredient;

const draft: RecipeDraft = {
  title: 'Crème & Soup',
  kind: 'recipe',
  meals: ['dinner'],
  serves: 4,
  time: '30 minutes',
  tags: ['soup'],
  batch: true,
  seasons: ['winter'],
  source: { name: 'Grandma', url: null },
  image: null,
  claudesPick: false,
  summary: 'A warm bowl.',
  ingredients: [flour],
  steps: ['Stir.'],
  notes: 'Freezes well.',
};

const edit = (changes: Partial<RecipeEdit> = {}): RecipeEdit => ({
  title: 'Soup',
  meals: ['dinner'],
  serves: 4,
  time: null,
  summary: 'A warm bowl.',
  ingredients: [flour],
  body: '## Steps\n1. Stir.',
  ...changes,
});

/** Whatever each kind of writer does to a file, for tests that hold them all to one rule. */
const WRITERS: Record<string, (recipes: RecipeRepository, slug: string) => void> = {
  update: (recipes, slug) => recipes.update(slug, edit()),
  keepPick: (recipes, slug) => recipes.keepPick(slug),
  setSeasons: (recipes, slug) => recipes.setSeasons(slug, ['summer']),
  setImage: (recipes, slug) => recipes.setImage(slug, PHOTO),
};

let dir: string;
let logged: string[];
let recipes: RecipeRepository;

const fileAt = (name: string) => path.join(dir, name);
const put = (name: string, text: string) => fs.writeFileSync(fileAt(name), text);
const read = (name: string) => fs.readFileSync(fileAt(name), 'utf8');

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-recipes-'));
  logged = [];
  recipes = fileRecipeRepository(dir, message => logged.push(message));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('a recipe’s night-before step', () => {
  const file = '---\ntitle: Beans\nmeals: [dinner]\nnight_before: Soak the beans overnight\n---\nGood beans.\n\n## Ingredients\n- 1 lb dry beans\n';
  const edit: RecipeEdit = { title: 'Beans', meals: ['dinner'], serves: 4, time: null, summary: 'Good beans.', ingredients: [], body: '' };
  const plain: RecipeDraft = { title: 'Toast', kind: 'recipe', meals: ['dinner'], serves: 4, time: null, tags: [], batch: false, seasons: [], source: null, image: null, summary: '', ingredients: [flour], steps: [], notes: null };

  it('reads from the header', () => {
    expect(parseRecipeFile('beans', file).nightBefore).toBe('Soak the beans overnight');
    expect(parseRecipeFile('beans', file.replace('night_before: Soak the beans overnight\n', '')).nightBefore).toBeNull();
  });

  it('isn’t read when it’s anything but a short line of plain words', () => {
    expect(parseRecipeFile('beans', file.replace('Soak the beans overnight', 'see https://evil.example')).nightBefore).toBeNull();
    expect(parseRecipeFile('beans', file.replace('Soak the beans overnight', 'true')).nightBefore).toBeNull();
  });

  it('survives an edit that leaves it out, changes with one that sets it, and goes with one that clears it', () => {
    expect(parseRecipeFile('beans', withEdit(file, edit)).nightBefore).toBe('Soak the beans overnight');
    expect(parseRecipeFile('beans', withEdit(file, { ...edit, nightBefore: 'Marinate overnight' })).nightBefore).toBe('Marinate overnight');
    expect(parseRecipeFile('beans', withEdit(file, { ...edit, nightBefore: null })).nightBefore).toBeNull();
  });

  it('goes into the file with an import, and stays out when there’s none', () => {
    const repo = fileRecipeRepository(fs.mkdtempSync(path.join(os.tmpdir(), 'night-before-')), () => undefined);
    expect(repo.get(repo.save({ ...plain, title: 'Beans', nightBefore: 'Soak the beans overnight' }))?.nightBefore).toBe('Soak the beans overnight');
    expect(repo.get(repo.save(plain))?.nightBefore).toBeNull();
  });
});

describe('round trip', () => {
  it('reads back what was saved', () => {
    const slug = recipes.save(draft);
    expect(slug).toBe('creme-and-soup');
    expect(recipes.get(slug)).toMatchObject({
      slug,
      title: draft.title,
      meals: ['dinner'],
      serves: 4,
      time: '30 minutes',
      tags: ['soup'],
      batch: true,
      seasons: ['winter'],
      source: { name: 'Grandma', url: null },
      summary: 'A warm bowl.',
      ingredients: [flour],
    });
    expect(recipes.get(slug)?.body).toContain('1. Stir.');
    expect(recipes.get(slug)?.body).toContain('Freezes well.');
  });

  it('gives a second recipe of the same name its own file', () => {
    expect(recipes.save(draft)).toBe('creme-and-soup');
    expect(recipes.save(draft)).toBe('creme-and-soup-2');
  });

  it('keeps the rest of the file when one header field changes', () => {
    const text = '---\ntitle: Soup\nclaudes_pick: true\nextra: kept\n---\n\nSummary\n\n## Ingredients\n* 1 onion\n\n## Steps\nStir.\n';
    const body = '\nSummary\n\n## Ingredients\n* 1 onion\n\n## Steps\nStir.\n';
    expect(withSeasons(text, ['fall']).endsWith(`---\n${body}`)).toBe(true);
    expect(withSeasons(text, ['fall'])).toContain('extra: kept');
    expect(withImage(text, PHOTO).endsWith(`---\n${body}`)).toBe(true);
    expect(withoutPick(text)).toBe('---\ntitle: Soup\nextra: kept\n---\n' + body);
  });

  it('treats a body that opens with a rule as body, not as more header', () => {
    const text = '---\ntitle: Soup\n---\n---\ntitle: Not the title\n---\nAfter the rule\n';
    const written = withImage(text, PHOTO);
    expect(parseRecipeFile('soup', written).title).toBe('Soup');
    expect(written).toContain('---\ntitle: Not the title\n---\nAfter the rule\n');
  });

  it('reads a hand-written file with no header at all', () => {
    put('plain.md', 'Just a note.\n\n## Ingredients\n- 1 onion\n');
    expect(recipes.get('plain')).toMatchObject({ title: 'plain', summary: 'Just a note.' });
    expect(logged).toEqual([]);
  });
});

describe('a file that will not parse', () => {
  const BAD = '---\ntitle: "Soup\nmeals: [dinner]\nimage:\n  kind: photo\n  file: soup-1.webp\n---\n\n## Ingredients\n- 1 onion\n';

  it.each(Object.keys(WRITERS))('is never rewritten by %s, however many times it was read', name => {
    put('soup.md', BAD);
    for (let i = 0; i < 3; i++) expect(recipes.get('soup')).toBeNull();
    expect(recipes.list()).toEqual([]);
    expect(() => WRITERS[name](recipes, 'soup')).toThrow();
    expect(read('soup.md')).toBe(BAD);
  });

  it('never reads as an empty recipe on a later try', () => {
    put('soup.md', BAD);
    expect(recipes.get('soup')).toBeNull();
    expect(recipes.get('soup')).toBeNull();
    expect(() => parseRecipeFile('soup', BAD)).toThrow();
    expect(() => parseRecipeFile('soup', BAD)).toThrow();
  });

  it('is logged, once while it stays broken, and again if it breaks again', () => {
    put('soup.md', BAD);
    recipes.list();
    recipes.list();
    recipes.get('soup');
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('soup');

    put('soup.md', '---\ntitle: Soup\n---\n');
    expect(recipes.get('soup')?.title).toBe('Soup');
    put('soup.md', BAD);
    recipes.list();
    expect(logged).toHaveLength(2);
  });

  it('does not take the other recipes with it', () => {
    put('soup.md', BAD);
    put('stew.md', '---\ntitle: Stew\n---\n');
    expect(recipes.list().map(r => r.slug)).toEqual(['stew']);
  });

  it('stays out of a new recipe of the same name', () => {
    put('creme-and-soup.md', BAD);
    expect(recipes.save(draft)).toBe('creme-and-soup-2');
    expect(read('creme-and-soup.md')).toBe(BAD);
  });

  it.each([
    ['a missing closing line, where the body would be lost', '---\ntitle: Soup\n# ## Ingredients\n'],
    ['a header that is not a set of fields', '---\njust some words\n---\n\n## Ingredients\n- 1 onion\n'],
    ['a header that is a list', '---\n- one\n- two\n---\n\nBody\n'],
    ['a blank line above the header', '\n---\ntitle: Soup\n---\n\nBody\n'],
    ['an extra dash on the header line', '----\ntitle: Soup\n---\n\nBody\n'],
  ])('includes %s', (_name, text) => {
    put('soup.md', text);
    expect(recipes.get('soup')).toBeNull();
    expect(() => recipes.setImage('soup', PHOTO)).toThrow();
    expect(read('soup.md')).toBe(text);
    expect(logged).toHaveLength(1);
  });

  it('leaves the original readable once the typo is fixed', () => {
    put('soup.md', BAD);
    expect(recipes.list()).toEqual([]);
    put('soup.md', BAD.replace('"Soup', 'Soup'));
    expect(recipes.get('soup')).toMatchObject({ title: 'Soup', image: PHOTO });
  });
});

describe('executable frontmatter', () => {
  const MARK = '__cuisine_recipe_ran__';
  const marks = () => (globalThis as Record<string, unknown>)[MARK];
  const code = `globalThis.${MARK} = true; ({ title: 'Ran' })`;

  beforeEach(() => { delete (globalThis as Record<string, unknown>)[MARK]; });
  afterEach(() => { delete (globalThis as Record<string, unknown>)[MARK]; });

  it.each([
    ['---js', `---js\n${code}\n---\n\nBody\n`],
    ['---javascript', `---javascript\n${code}\n---\n\nBody\n`],
    ['---JS', `---JS\n${code}\n---\n\nBody\n`],
    ['--- js', `--- js\n${code}\n---\n\nBody\n`],
    ['---js with Windows line endings', `---js\r\n${code}\r\n---\r\n\r\nBody\r\n`],
    ['---js behind a byte order mark', `﻿---js\n${code}\n---\n\nBody\n`],
    ['---json', '---json\n{ "title": "Json" }\n---\n\nBody\n'],
    ['an unknown language', '---coffee\ntitle: "x"\n---\n\nBody\n'],
  ])('%s does not run, does not stop the listing, and is logged', (_name, text) => {
    put('evil.md', text);
    put('stew.md', '---\ntitle: Stew\n---\n');
    expect(recipes.list().map(r => r.slug)).toEqual(['stew']);
    expect(recipes.get('evil')).toBeNull();
    expect(marks()).toBeUndefined();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('evil');
    expect(read('evil.md')).toBe(text);
  });

  it('does not run when a write is attempted either', () => {
    const text = `---js\n${code}\n---\n\nBody\n`;
    put('evil.md', text);
    for (const write of Object.values(WRITERS)) expect(() => write(recipes, 'evil')).toThrow();
    expect(marks()).toBeUndefined();
    expect(read('evil.md')).toBe(text);
  });

  it('does not run from a body that opens like a header when the file is rewritten', () => {
    const text = `---\ntitle: Soup\n---\n---js\n${code}\n---\nBody\n`;
    put('soup.md', text);
    recipes.setImage('soup', PHOTO);
    recipes.setSeasons('soup', ['fall']);
    recipes.keepPick('soup');
    expect(marks()).toBeUndefined();
    expect(recipes.get('soup')?.title).toBe('Soup');
    expect(read('soup.md')).toContain(`---js\n${code}\n---\nBody\n`);
  });

  it('still takes a header that names yaml', () => {
    put('soup.md', '---yaml\ntitle: Soup\n---\n\nBody\n');
    put('stew.md', '---yml\ntitle: Stew\n---\n\nBody\n');
    expect(recipes.list().map(r => r.title)).toEqual(['Soup', 'Stew']);
  });
});

describe('writing', () => {
  const GOOD = '---\ntitle: Soup\nserves: 2\n---\n\n## Ingredients\n- 1 onion\n';

  it('leaves no temp file behind', () => {
    const slug = recipes.save(draft);
    put('soup.md', GOOD);
    for (const write of Object.values(WRITERS)) write(recipes, 'soup');
    expect(fs.readdirSync(dir).sort()).toEqual([`${slug}.md`, 'soup.md']);
  });

  it.each(Object.keys(WRITERS))('%s keeps the only copy whole when the swap fails', name => {
    put('soup.md', GOOD);
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('crashed'); });
    expect(() => WRITERS[name](recipes, 'soup')).toThrow('crashed');
    expect(read('soup.md')).toBe(GOOD);
    expect(fs.readdirSync(dir)).toEqual(['soup.md']);
  });

  it('never opens the real file for writing', () => {
    put('soup.md', GOOD);
    const write = vi.spyOn(fs, 'writeFileSync');
    recipes.setImage('soup', PHOTO);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).not.toBe(fileAt('soup.md'));
    expect(path.dirname(String(write.mock.calls[0][0]))).toBe(dir);
  });

  it('does not list a temp file a crash left behind', () => {
    put('soup.md', GOOD);
    put('soup.md.tmp', '---\ntitle: Half writ');
    expect(recipes.list().map(r => r.slug)).toEqual(['soup']);
    expect(logged).toEqual([]);
  });

  it('logs a recipe file whose name can never be a slug, rather than dropping it silently', () => {
    put('Soup Copy.md', GOOD);
    expect(recipes.list()).toEqual([]);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('Soup Copy.md');
  });
});

describe('slugs', () => {
  const OUTSIDE = '../outside';
  const BAD_SLUGS = [OUTSIDE, '..', 'a/b', 'a\\b', 'Soup', '', 'soup\n', 'soup.md'];
  const outsideFile = () => path.join(path.dirname(dir), 'outside.md');

  afterEach(() => { fs.rmSync(outsideFile(), { force: true }); });

  it.each(BAD_SLUGS)('%j is refused by every write', slug => {
    expect(() => recipes.save(draft, slug)).toThrow();
    for (const write of Object.values(WRITERS)) expect(() => write(recipes, slug)).toThrow();
    expect(() => recipes.remove(slug)).toThrow();
    expect(recipes.get(slug)).toBeNull();
  });

  it('cannot reach a file outside the recipes folder', () => {
    const text = '---\ntitle: Outside\n---\n\n## Ingredients\n- 1 onion\n';
    fs.writeFileSync(outsideFile(), text);
    expect(recipes.get(OUTSIDE)).toBeNull();
    expect(() => recipes.setImage(OUTSIDE, PHOTO)).toThrow();
    expect(() => recipes.save(draft, OUTSIDE)).toThrow();
    expect(() => recipes.remove(OUTSIDE)).toThrow();
    expect(fs.readFileSync(outsideFile(), 'utf8')).toBe(text);
  });
});

describe('editing', () => {
  const FILE = [
    '---',
    'title: Soup',
    'tags:',
    '  - kept',
    '---',
    '',
    'A warm bowl.',
    '',
    '## Ingredients',
    'Weigh the flour if you can.',
    '- 2 cups flour',
    '',
    'Use the good stock.',
    'Homemade if there is any.',
    '',
    '### Topping',
    'Only if the kids are eating.',
    '- 1 cup cheese',
    '',
    '### Garnish',
    'Whatever is in the garden.',
    '- 1 sprig parsley',
    '',
    '## Steps',
    '1. Stir.',
    '',
  ].join('\n');
  const cheese = parseIngredientLine('- 1 cup cheese', 'Topping') as Ingredient;

  it('keeps text in the ingredients section that is not an ingredient', () => {
    const written = withEdit(FILE, edit({ ingredients: [flour, cheese] }));
    expect(written).toContain('Weigh the flour if you can.');
    expect(written).toContain('Use the good stock.\nHomemade if there is any.');
    expect(written).toContain('### Topping\nOnly if the kids are eating.\n\n- 1 cup cheese');
  });

  it('keeps text whose group the edit removed', () => {
    expect(withEdit(FILE, edit({ ingredients: [flour, cheese] }))).toContain('Whatever is in the garden.');
  });

  it('still parses the same ingredients and nothing extra', () => {
    const written = withEdit(FILE, edit({ ingredients: [flour, cheese] }));
    const recipe = parseRecipeFile('soup', written);
    expect(recipe.ingredients).toEqual([flour, cheese]);
    expect(recipe.summary).toBe('A warm bowl.');
    expect(recipe.body).toBe('## Steps\n1. Stir.');
  });

  it('settles after one edit, so repeated edits neither lose nor pile up text', () => {
    const once = withEdit(FILE, edit({ ingredients: [flour, cheese] }));
    expect(withEdit(once, edit({ ingredients: [flour, cheese] }))).toBe(once);
  });

  it('keeps a bullet the ingredient grammar cannot read', () => {
    const text = '---\ntitle: Soup\n---\n\n## Ingredients\n- (optional)\n- 2 cups flour\n';
    expect(withEdit(text, edit())).toContain('- (optional)');
  });

  it('does not add anything to a section that is all ingredients', () => {
    const text = '---\ntitle: Soup\n---\n\n## Ingredients\n- 2 cups flour\n\n## Steps\n1. Stir.\n';
    expect(withEdit(text, edit())).toContain('## Ingredients\n- 2 cups flour\n\n## Steps');
  });

  it('keeps the rest of the header', () => {
    expect(parseRecipeFile('soup', withEdit(FILE, edit())).tags).toEqual(['kept']);
  });
});
