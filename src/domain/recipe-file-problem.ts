// A recipe file that couldn't join the book, said plainly: a person with a text editor can fix
// these, and shouldn't need the server's log to find out. The wording is fixed on purpose, so
// nothing from a parser's message (a path, a line of the file) ever reaches the screen.
export type RecipeFileProblemKind = 'typo' | 'not-plain' | 'misplaced' | 'unclosed' | 'not-fields' | 'file-name' | 'unopenable' | 'unknown';

export type RecipeFileProblem = { file: string; kind: RecipeFileProblemKind };

export const RECIPE_FILE_PROBLEM_WORDS: Record<RecipeFileProblemKind, string> = {
  typo: 'the header has a typo',
  'not-plain': 'the header has to be plain fields, and this one isn’t, so it was left alone',
  misplaced: 'the header has to start on the very first line, with exactly three dashes',
  unclosed: 'the header is missing its closing line of three dashes',
  'not-fields': 'the header isn’t a list of fields',
  'file-name': 'file names can only use lowercase letters, numbers and dashes',
  unopenable: 'the file couldn’t be opened',
  unknown: 'something in it doesn’t look right',
};

const LONGEST_NAME = 100;

/** A file's name, fit to show as text: no control or invisible characters (which can reorder what's on screen), and not endless. */
export function fileNameToShow(name: string): string {
  const visible = name.replace(/[\p{Cc}\p{Cf}]/gu, '');
  const characters = [...visible];
  return characters.length > LONGEST_NAME ? `${characters.slice(0, LONGEST_NAME).join('')}…` : visible;
}
