import { describe, expect, it } from 'vitest';
import { changedFields, changedLines, formFromRecipe, type RecipeForm } from './recipe-form.ts';

const form: RecipeForm = {
  title: 'Soup', meals: ['dinner'], serves: '4', time: '30 min', nightBefore: '', summary: 'A soup.',
  ingredients: 'For the base:\n3 cloves garlic\n1 cup cream', body: '## Steps\n1. Simmer.',
};

describe('changedFields', () => {
  it('says nothing changed for the same form', () => {
    expect(changedFields(form, { ...form, meals: [...form.meals] })).toEqual([]);
  });

  it('names each field whose words differ', () => {
    expect(changedFields(form, { ...form, time: '1 hr', ingredients: 'For the base:\n6 cloves garlic\n1 cup cream' })).toEqual(['time', 'ingredients']);
    expect(changedFields(form, { ...form, title: 'Stew', body: '## Steps\n1. Boil.' })).toEqual(['title', 'body']);
  });

  it('doesn’t count spaces, line endings or list markers as a change', () => {
    expect(changedFields(form, {
      ...form,
      summary: '  A soup. \n',
      body: '## Steps  \r\n1. Simmer.\n',
      ingredients: '- For the base:\n\n  3 cloves garlic \n* 1 cup cream\n',
    })).toEqual([]);
  });

  it('counts lines that moved, since the order is how the recipe reads', () => {
    expect(changedFields(form, { ...form, ingredients: 'For the base:\n1 cup cream\n3 cloves garlic' })).toEqual(['ingredients']);
  });

  it('reads meals as a set, and serves as a number', () => {
    expect(changedFields({ ...form, meals: ['lunch', 'dinner'] }, { ...form, meals: ['dinner', 'lunch'] })).toEqual([]);
    expect(changedFields(form, { ...form, meals: ['dinner', 'lunch'] })).toEqual(['meals']);
    expect(changedFields(form, { ...form, serves: '4.0' })).toEqual([]);
    expect(changedFields(form, { ...form, serves: '8' })).toEqual(['serves']);
    expect(changedFields({ ...form, serves: '' }, { ...form, serves: '0' })).toEqual(['serves']);
  });
});

describe('changedLines', () => {
  it('lists what came in and what went out', () => {
    expect(changedLines(form.ingredients, 'For the base:\n6 cloves garlic\n1 cup milk')).toEqual({
      added: ['6 cloves garlic', '1 cup milk'], removed: ['3 cloves garlic', '1 cup cream'],
    });
  });
  it('leaves out lines that are still there, wherever they are', () => {
    expect(changedLines(form.ingredients, '1 cup cream\nFor the base:\n3 cloves garlic')).toEqual({ added: [], removed: [] });
  });
});

describe('formFromRecipe', () => {
  it('holds what the form shows, with ingredients as lines', () => {
    expect(formFromRecipe({
      title: 'Soup', meals: ['dinner'], serves: 4, time: null, nightBefore: 'Soak the beans overnight', summary: 'A soup.', body: '',
      ingredients: [{ amount: 2, amountMax: null, unit: 'cup', item: 'flour', note: 'sifted', optional: false, group: null }],
    })).toEqual({ title: 'Soup', meals: ['dinner'], serves: '4', time: '', nightBefore: 'Soak the beans overnight', summary: 'A soup.', ingredients: '2 cups flour, sifted', body: '' });
  });
});
