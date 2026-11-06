// Adding a step runs over files people wrote by hand, with no one asking: only the one line may change.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileRecipeRepository } from './file-recipe-repository.ts';
import { parseRecipeFile } from './recipe-markdown.ts';
import { withNightBefore } from './recipe-night-before.ts';

const LINE = 'night_before: Soak the beans overnight';
const STEP = 'Soak the beans overnight';

/** Every byte of the original, with one line added right before the header's closing line. */
const expectOnlyTheLineAdded = (original: string, written: string | null, eol = '\n') => {
  const closing = original.indexOf('\n---', 3) + 1;
  expect(written).toBe(`${original.slice(0, closing)}${LINE}${eol}${original.slice(closing)}`);
};

describe('withNightBefore', () => {
  it('keeps comments, odd quoting, order and spacing in a hand-written header', () => {
    const file = [
      '---',
      '# our favourite',
      "title:    'Grandma''s beans'   # don't change",
      'tags: [ soup,beans ]',
      'meals:',
      '    - dinner',
      'serves: 4.0',
      'source: {name: "Grandma", url: null}',
      'unknown_field: keep me',
      '---',
      '',
      '',
      'Summary with   spaces.   ',
      '',
      '## Ingredients',
      '- 1 lb dry beans',
      '* 1  onion',
      '',
      '## Steps',
      '1. Cook.\t',
      '--- not a header',
      '',
      '',
    ].join('\n');
    expectOnlyTheLineAdded(file, withNightBefore(file, STEP));
  });

  it('keeps Windows line endings', () => {
    const file = '---\r\ntitle: Beans\r\nmeals: [dinner]\r\n---\r\nGood.\r\n\r\n## Ingredients\r\n- 1 lb dry beans\r\n';
    expectOnlyTheLineAdded(file, withNightBefore(file, STEP), '\r\n');
  });

  it('keeps a byte order mark, and a file with no final newline', () => {
    const file = '﻿---\ntitle: Beans\n---\n## Ingredients\n- 1 lb dry beans';
    expect(withNightBefore(file, STEP)).toBe(`﻿---\ntitle: Beans\n${LINE}\n---\n## Ingredients\n- 1 lb dry beans`);
  });

  it('gives a file with no header just the one it needs', () => {
    const file = 'Just a note.\n\n## Ingredients\n- 1 lb dry beans\n';
    const written = withNightBefore(file, STEP)!;
    expect(written).toBe(`---\n${LINE}\n---\n${file}`);
    expect(parseRecipeFile('beans', written).nightBefore).toBe(STEP);
  });

  it('reads back as the same recipe plus the step', () => {
    const file = '---\ntitle: Beans\nmeals: [dinner]\nserves: 6\ntags: [soup]\nseasons: [winter]\n---\nGood.\n\n## Ingredients\n- 1 lb dry beans\n\n## Steps\n1. Cook.\n';
    const before = parseRecipeFile('beans', file);
    expect(parseRecipeFile('beans', withNightBefore(file, STEP)!)).toEqual({ ...before, nightBefore: STEP });
  });

  it('quotes a step that wouldn’t otherwise read the same', () => {
    for (const step of ['Salt it: then chill', 'True', '12 hours in brine', 'Thaw it, 2 days’ worth']) {
      const written = withNightBefore('---\ntitle: Beans\n---\nGood.\n', step)!;
      expect(parseRecipeFile('beans', written).nightBefore).toBe(step);
    }
  });

  it('never touches a header that already says something about it', () => {
    for (const value of ['Rinse the beans', '""', '', 'see https://our.example', 'null']) {
      expect(withNightBefore(`---\ntitle: Beans\nnight_before: ${value}\n---\nGood.\n`, STEP)).toBeNull();
    }
  });

  it('refuses rather than guesses when a header can’t be read', () => {
    expect(() => withNightBefore('---\ntitle: Beans\nnever closed\n', STEP)).toThrow();
  });
});

describe('addNightBefore', () => {
  const folder = () => fs.mkdtempSync(path.join(os.tmpdir(), 'night-before-'));

  it('writes the file, says so, and the second time changes nothing', () => {
    const dir = folder();
    const file = path.join(dir, 'beans.md');
    fs.writeFileSync(file, '---\ntitle: Beans\n---\nGood.\n');
    const repo = fileRecipeRepository(dir, () => undefined);
    expect(repo.addNightBefore('beans', STEP)).toBe(true);
    const once = fs.readFileSync(file, 'utf8');
    expect(repo.addNightBefore('beans', 'Something else')).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toBe(once);
    expect(repo.get('beans')?.nightBefore).toBe(STEP);
  });

  it('leaves a step set by hand exactly as it is', () => {
    const dir = folder();
    const file = path.join(dir, 'beans.md');
    const text = '---\ntitle: Beans\nnight_before: Rinse and soak\n---\nGood.\n';
    fs.writeFileSync(file, text);
    expect(fileRecipeRepository(dir, () => undefined).addNightBefore('beans', STEP)).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toBe(text);
  });
});
