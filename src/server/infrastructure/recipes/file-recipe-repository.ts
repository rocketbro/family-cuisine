// Recipes are markdown files in the data directory: one file per recipe, named by slug.
// Read fresh on each listing (there are dozens, not thousands), so hand edits show up at once.
// A file that can't be read is left exactly as it is and reported, and comes back once it's fixed.
import fs from 'node:fs';
import path from 'node:path';
import { slugify, type Recipe } from '../../../domain/recipe.ts';
import type { RecipeRepository } from '../../application/ports/recipes.ts';
import type { RecipeFileProblem } from '../../../domain/recipe-file-problem.ts';
import { problemKind } from './recipe-file-problem-kind.ts';
import { parseRecipeFile, serializeDraft, withEdit, withImage, withoutPick, withSeasons } from './recipe-markdown.ts';
import { withNightBefore } from './recipe-night-before.ts';
import { writeAtomically } from './write-atomically.ts';

const SLUG = /^[a-z0-9-]+$/;
const EXTENSION = '.md';

export function fileRecipeRepository(dir: string, log: (message: string) => void): RecipeRepository {
  fs.mkdirSync(dir, { recursive: true });

  const fileFor = (slug: string) => {
    if (!SLUG.test(slug)) throw new Error('That recipe isn’t available.');
    return path.join(dir, `${slug}${EXTENSION}`);
  };

  // Almost every screen lists the recipes, so each problem is reported once until it changes.
  const reported = new Map<string, string>();
  const report = (name: string, problem: string) => {
    if (reported.get(name) === problem) return;
    reported.set(name, problem);
    log(`recipe file ${name} skipped and left as it is: ${problem}`);
  };

  const get = (slug: string): Recipe | null => {
    if (!SLUG.test(slug)) return null;
    const name = `${slug}${EXTENSION}`;
    try {
      const recipe = parseRecipeFile(slug, fs.readFileSync(fileFor(slug), 'utf8'));
      reported.delete(name);
      return recipe;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') reported.delete(name);
      else report(name, (error as Error).message.split('\n')[0]);
      return null;
    }
  };

  /** Throws before writing anything if the file doesn't read, so the original stays as it is. */
  const rewrite = (slug: string, change: (text: string) => string) => {
    const file = fileFor(slug);
    writeAtomically(file, change(fs.readFileSync(file, 'utf8')));
  };

  return {
    list() {
      return fs.readdirSync(dir)
        .filter(name => name.endsWith(EXTENSION))
        .map(name => {
          const slug = name.slice(0, -EXTENSION.length);
          if (SLUG.test(slug)) return get(slug);
          report(name, 'recipe file names use only lowercase letters, digits and dashes');
          return null;
        })
        .filter((r): r is Recipe => r !== null)
        .sort((a, b) => a.title.localeCompare(b.title));
    },
    problems() {
      return fs.readdirSync(dir)
        .filter(name => name.endsWith(EXTENSION))
        .sort()
        .flatMap((name): RecipeFileProblem[] => {
          const slug = name.slice(0, -EXTENSION.length);
          if (!SLUG.test(slug)) return [{ file: name, kind: 'file-name' }];
          try {
            parseRecipeFile(slug, fs.readFileSync(fileFor(slug), 'utf8'));
            return [];
          } catch (error) {
            return (error as NodeJS.ErrnoException).code === 'ENOENT' ? [] : [{ file: name, kind: problemKind(error) }];
          }
        });
    },
    get,
    save(draft, slug) {
      let target = slug ?? slugify(draft.title);
      if (!slug) {
        const base = target;
        for (let n = 2; fs.existsSync(fileFor(target)); n++) target = `${base}-${n}`;
      }
      writeAtomically(fileFor(target), serializeDraft(draft));
      return target;
    },
    update(slug, edit) {
      rewrite(slug, text => withEdit(text, edit));
    },
    keepPick(slug) {
      rewrite(slug, withoutPick);
    },
    remove(slug) {
      fs.rmSync(fileFor(slug), { force: true });
    },
    setSeasons(slug, seasons) {
      rewrite(slug, text => withSeasons(text, seasons));
    },
    addNightBefore(slug, step) {
      const file = fileFor(slug);
      const written = withNightBefore(fs.readFileSync(file, 'utf8'), step);
      if (written === null) return false;
      writeAtomically(file, written);
      return true;
    },
    setImage(slug, image) {
      rewrite(slug, text => withImage(text, image));
    },
  };
}
