import { describe, expect, it } from 'vitest';
import type { RecipeForm } from './recipe-form.ts';
import { checkRevision, type SaidRevision } from './recipe-revision.ts';

const sent: RecipeForm = {
  title: 'Soup', meals: ['dinner'], serves: '4', time: '30 min', nightBefore: '', summary: 'A soup.',
  ingredients: '3 cloves garlic\n1 cup cream\nour good salt to taste', body: '## Steps\n1. Add the cream.',
};
const same: SaidRevision = {
  understood: true, note: 'Nothing to do.', title: 'Soup', meals: ['dinner'], serves: 4, time: '30 min', nightBefore: null, summary: 'A soup.',
  ingredients: ['3 cloves garlic', '1 cup cream', 'our good salt to taste'], body: '## Steps\n1. Add the cream.',
};
const check = (over: Partial<SaidRevision>, form = sent) => checkRevision(form, { ...same, ...over });
const problem = (over: Partial<SaidRevision>, form = sent) => {
  const result = check(over, form);
  return 'problem' in result ? result.problem : null;
};
const accepted = (over: Partial<SaidRevision>, form = sent) => {
  const result = check(over, form);
  if ('problem' in result) throw new Error(result.problem);
  return result.form;
};

describe('checkRevision', () => {
  it('takes a night-before step in the same clean form as any other', () => {
    expect(accepted({ nightBefore: ' Soak the beans overnight. ' }).nightBefore).toBe('Soak the beans overnight');
  });

  it('can take a step off', () => {
    expect(accepted({ nightBefore: null }, { ...sent, nightBefore: 'Soak the beans overnight' }).nightBefore).toBe('');
  });

  it('refuses the whole answer for a step with a link or markup in it', () => {
    expect(problem({ nightBefore: 'Soak at https://evil.example' })).toContain('night-before');
    expect(problem({ nightBefore: '**Soak**' })).toContain('night-before');
    expect(problem({ nightBefore: 'a'.repeat(121) })).toContain('night-before');
  });

  it('gives back a step Claude left alone exactly as it was sent', () => {
    const typed = { ...sent, nightBefore: 'see our-site.example first ' };
    expect(accepted({ nightBefore: 'see our-site.example first' }, typed).nightBefore).toBe(typed.nightBefore);
  });

  it('passes a good answer through as the form holds it', () => {
    expect(accepted({ time: '1 hr', ingredients: ['6 cloves garlic', '1 cup milk', 'our good salt to taste'], body: '## Steps\n1. Add the milk.' })).toEqual({
      ...sent, time: '1 hr', ingredients: '6 cloves garlic\n1 cup milk\nour good salt to taste', body: '## Steps\n1. Add the milk.',
    });
  });

  it('gives back exactly what was sent where Claude only tidied it', () => {
    const typed: RecipeForm = { ...sent, title: 'Soup ', serves: '4.0', summary: '  A soup.\n', ingredients: '- 3 cloves garlic\n\n1 cup cream \nour good salt to taste\n', body: '## Steps  \n1. Add the cream.\n' };
    expect(accepted({}, typed)).toEqual(typed);
  });

  it('keeps meals and serves the form holds when the answer has none', () => {
    expect(accepted({ meals: [], serves: null })).toEqual(sent);
    expect(accepted({ serves: null }, { ...sent, serves: '' }).serves).toBe('');
    expect(accepted({ time: null }).time).toBe('');
  });

  it('puts meals in their usual order, once each', () => {
    expect(accepted({ meals: ['dinner', 'breakfast', 'dinner'] }).meals).toEqual(['breakfast', 'dinner']);
  });

  it('takes a list marker off a line but doesn’t count it as new', () => {
    expect(accepted({ ingredients: ['- 6 cloves garlic', '1 cup cream', 'our good salt to taste'] }).ingredients).toBe('6 cloves garlic\n1 cup cream\nour good salt to taste');
  });

  it('holds new lines to the grammar, but not lines the person already had', () => {
    expect(accepted({}).ingredients).toContain('our good salt to taste');
    expect(problem({ ingredients: ['two cups flour', '1 cup cream'] })).toContain('“two cups flour”');
    expect(problem({ ingredients: ['1 cup milk (instead of cream)'] })).toContain('pantry can’t read');
  });

  it('keeps group lines', () => {
    expect(accepted({ ingredients: ['For the base:', '3 cloves garlic'] }).ingredients).toBe('For the base:\n3 cloves garlic');
  });

  it.each<[string, Partial<SaidRevision>]>([
    ['no name', { title: '  ' }],
    ['a name too long to save', { title: 'x'.repeat(201) }],
    ['zero servings', { serves: 0 }],
    ['negative servings', { serves: -2 }],
    ['absurd servings', { serves: 500 }],
    ['not a number', { serves: Number.NaN }],
    ['a time too long to save', { time: 'x'.repeat(101) }],
    ['a description too long to save', { summary: 'x'.repeat(5001) }],
    ['a heading in the description', { summary: 'A soup.\n## Notes' }],
    ['no ingredients', { ingredients: [] }],
    ['only a group line', { ingredients: ['For the base:'] }],
    ['all the steps gone', { body: ' ' }],
    ['a second ingredient list', { body: '## Ingredients\n- 1 cup milk' }],
    ['steps too long to save', { body: 'x'.repeat(50001) }],
  ])('refuses %s, and says nothing changed', (_why, over) => {
    expect(problem(over)).toContain('so nothing changed');
  });

  it('lets a recipe with no steps stay that way', () => {
    expect(accepted({ body: '' }, { ...sent, body: '' }).body).toBe('');
  });
});
