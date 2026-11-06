// Replaces a file in one step: a crash leaves either the old copy or the new one, never half of one.
import fs from 'node:fs';

export function writeAtomically(file: string, text: string): void {
  const tmp = `${file}.tmp`;
  try {
    fs.writeFileSync(tmp, text, { flush: true });
    fs.renameSync(tmp, file);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}
