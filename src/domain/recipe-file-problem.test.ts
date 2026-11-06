import { describe, expect, it } from 'vitest';
import { fileNameToShow } from './recipe-file-problem.ts';

describe('fileNameToShow', () => {
  it('leaves an ordinary name alone', () => {
    expect(fileNameToShow('taco-night.md')).toBe('taco-night.md');
    expect(fileNameToShow('Crème brûlée.md')).toBe('Crème brûlée.md');
  });

  it('drops line breaks and characters that reorder or hide text', () => {
    expect(fileNameToShow('a\nb\u0007.md')).toBe('ab.md');
    expect(fileNameToShow('soup‮dm.exe.md')).toBe('soupdm.exe.md');
    expect(fileNameToShow('so​up.md')).toBe('soup.md');
  });

  it('cuts off an endless name without splitting a character', () => {
    const shown = fileNameToShow(`${'🍲'.repeat(150)}.md`);
    expect([...shown]).toHaveLength(101);
    expect(shown.endsWith('🍲…')).toBe(true);
  });
});
