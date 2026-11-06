// The header of a recipe file, and the only place that touches gray-matter. Recipe files get
// shared, so the header is data: YAML and nothing else.
import matter from 'gray-matter';
import type { RecipeFileProblemKind } from '../../../domain/recipe-file-problem.ts';

export type RecipeFileParts = { data: Record<string, unknown>; content: string };

/** A header refused on purpose; `kind` is what the person gets told, the message what the log gets. */
export class RecipeHeaderError extends Error {
  kind: RecipeFileProblemKind;
  constructor(kind: RecipeFileProblemKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

/** gray-matter picks a parser from what follows the opening `---`, and its "javascript" one is eval. */
const YAML_LANGUAGES = ['', 'yaml', 'yml'];

// Passing options is also what keeps gray-matter's cache out of this: it caches a file before
// parsing it, so a file that failed once would read as an empty header with the whole file as
// its body the next time, and writing that back would bury the real header.
const OPTIONS = {
  engines: {
    javascript: (): object => { throw new RecipeHeaderError('not-plain', 'Recipe headers can’t be JavaScript.'); },
  },
};

/** Throws if the file can't be read as it stands, so nothing gets rewritten from a misreading. */
export function readRecipeFile(text: string): RecipeFileParts {
  requireReadableHeader(text);
  const { data, content } = matter(text, OPTIONS);
  if (Object.getPrototypeOf(data) !== Object.prototype) throw new RecipeHeaderError('not-fields', 'The header isn’t a set of fields.');
  return { data, content };
}

/** Takes the body as an object: gray-matter would parse a string, and a body can open like a header. */
export function writeRecipeFile(content: string, data: Record<string, unknown>): string {
  return matter.stringify({ content }, data);
}

function requireReadableHeader(text: string): void {
  const file = text.replace(/^﻿/, '');
  if (!file.trimStart().startsWith('---')) return;
  if (!/^---(?!-)/.test(file)) throw new RecipeHeaderError('misplaced', 'The header has to start on the first line, with exactly three dashes.');
  const language = file.slice(3).split(/\r?\n/, 1)[0].trim();
  if (!YAML_LANGUAGES.includes(language.toLowerCase())) throw new RecipeHeaderError('not-plain', 'The header has to be YAML.');
  if (!file.includes('\n---', 3)) throw new RecipeHeaderError('unclosed', 'The header has no closing line.');
}
