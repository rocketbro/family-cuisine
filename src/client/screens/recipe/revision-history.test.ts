import { describe, expect, it } from 'vitest';
import type { RecipeForm } from '../../../domain/recipe-form.ts';
import { fieldsInWords, markedFields, revisedLines, revisionOf, withoutLastRevision } from './revision-history.ts';

const saved: RecipeForm = {
  title: 'Soup', meals: ['dinner'], serves: '4', time: '', nightBefore: '', summary: 'A soup.',
  ingredients: '3 cloves garlic\n1 cup cream', body: '## Steps\n1. Add the cream.',
};

describe('what the sheet marks as Claude’s', () => {
  it('marks only what Claude changed, not what the person typed before speaking', () => {
    const typed = { ...saved, title: 'My soup' };
    const after = { ...typed, time: '1 hr', ingredients: '6 cloves garlic\n1 cup cream' };
    expect([...markedFields([revisionOf(typed, after, 'Done.')])]).toEqual(['time', 'ingredients']);
  });

  it('marks nothing when Claude changed nothing', () => {
    expect(markedFields([revisionOf(saved, { ...saved }, 'Already so.')]).size).toBe(0);
  });

  it('keeps earlier marks through a second revision', () => {
    const first = { ...saved, time: '1 hr' };
    const second = { ...first, title: 'Stew' };
    expect([...markedFields([revisionOf(saved, first, ''), revisionOf(first, second, '')])].sort()).toEqual(['time', 'title']);
  });
});

describe('withoutLastRevision', () => {
  it('puts back what Claude changed last', () => {
    const first = { ...saved, time: '1 hr' };
    const second = { ...first, ingredients: '6 cloves garlic\n1 cup cream' };
    const history = [revisionOf(saved, first, ''), revisionOf(first, second, '')];
    const undone = withoutLastRevision(second, history);
    expect(undone.form).toEqual(first);
    expect(undone.history).toEqual(history.slice(0, 1));
    expect(withoutLastRevision(undone.form, undone.history).form).toEqual(saved);
  });

  it('keeps what was typed in other fields since', () => {
    const after = { ...saved, time: '1 hr' };
    const history = [revisionOf(saved, after, '')];
    expect(withoutLastRevision({ ...after, title: 'Typed after' }, history).form).toEqual({ ...saved, title: 'Typed after' });
  });

  it('leaves the form alone with nothing to undo', () => {
    expect(withoutLastRevision(saved, [])).toEqual({ form: saved, history: [] });
  });
});

describe('revisedLines', () => {
  it('compares with the form before Claude’s first change, not the last', () => {
    const first = { ...saved, ingredients: '6 cloves garlic\n1 cup cream' };
    const second = { ...first, ingredients: '6 cloves garlic\n1 cup milk' };
    expect(revisedLines(second, [revisionOf(saved, first, ''), revisionOf(first, second, '')])).toEqual({
      added: ['6 cloves garlic', '1 cup milk'], removed: ['3 cloves garlic', '1 cup cream'],
    });
  });
  it('is empty before Claude has done anything', () => {
    expect(revisedLines({ ...saved, ingredients: 'typed' }, [])).toEqual({ added: [], removed: [] });
  });
});

describe('fieldsInWords', () => {
  it('reads as a sentence', () => {
    expect(fieldsInWords(['time'])).toBe('the time');
    expect(fieldsInWords(['time', 'body'])).toBe('the time and the steps');
    expect(fieldsInWords(['title', 'time', 'body'])).toBe('the name, the time and the steps');
  });
});
