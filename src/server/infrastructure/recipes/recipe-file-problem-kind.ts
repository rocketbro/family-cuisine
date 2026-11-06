// Sorts what went wrong reading a recipe file into what a person gets told. The error's own
// message stays in the log: a parser's quotes the file, and the file system's holds a full path.
import type { RecipeFileProblemKind } from '../../../domain/recipe-file-problem.ts';
import { RecipeHeaderError } from './recipe-frontmatter.ts';

export function problemKind(error: unknown): RecipeFileProblemKind {
  if (error instanceof RecipeHeaderError) return error.kind;
  if ((error as Error).name === 'YAMLException') return 'typo';
  if ((error as NodeJS.ErrnoException).code) return 'unopenable';
  return 'unknown';
}
