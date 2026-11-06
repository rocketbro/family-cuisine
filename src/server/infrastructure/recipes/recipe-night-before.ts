// Adds one line to a recipe's header and leaves every other byte of the file as it was. Unlike the
// other header changes, which write the header out again, this runs over files someone wrote by hand
// with no one asking, so their comments, quoting and order have to survive.
import { isDeepStrictEqual } from 'node:util';
import { readRecipeFile } from './recipe-frontmatter.ts';

const FIELD = 'night_before';
const BOM = '﻿';

/** The file with the step added, or null to leave it alone: its header already has the field, or the line can't go in cleanly. */
export function withNightBefore(text: string, step: string): string | null {
  const before = readRecipeFile(text);
  if (FIELD in before.data) return null;
  const written = withHeaderLine(text, `${FIELD}: ${yamlText(step)}`);
  const after = readRecipeFile(written);
  const clean = after.content === before.content && isDeepStrictEqual(after.data, { ...before.data, [FIELD]: step });
  return clean ? written : null;
}

function withHeaderLine(text: string, line: string): string {
  const bom = text.startsWith(BOM) ? BOM : '';
  const file = text.slice(bom.length);
  if (!file.trimStart().startsWith('---')) return `${bom}---\n${line}\n---\n${file}`;
  // The same closing line the header's reader settles on.
  const closing = file.indexOf('\n---', 3) + 1;
  const eol = file[closing - 2] === '\r' ? '\r\n' : '\n';
  return `${bom}${file.slice(0, closing)}${line}${eol}${file.slice(closing)}`;
}

/** Plain when it reads the same to YAML, as it does for almost any step, and quoted otherwise. */
function yamlText(step: string): string {
  const plain = /^[A-Za-z][A-Za-z0-9 ,'’()/-]*$/.test(step) && !/^(?:yes|no|on|off|true|false|null|y|n)$/i.test(step);
  return plain ? step : JSON.stringify(step);
}
