import { describe, expect, it } from 'vitest';
import { addFridgeLine, fridgeForClaude, fridgeLines, usedUpFridgeLine } from './fridge.ts';
import { TODAY, transactionalFakes } from './test-support/transactional-fakes.ts';

const LATER = '2026-11-08';
const TOO_LATE = '2026-11-12';

describe('the fridge list', () => {
  it('adds a line in the family’s words, dated today', () => {
    const { deps } = transactionalFakes([]);
    addFridgeLine(deps, '  sautéed onions, peppers and black beans ', TODAY);
    expect(fridgeLines(deps, TODAY)).toMatchObject([{ text: 'sautéed onions, peppers and black beans', since: TODAY, dinner: null }]);
  });

  it('refuses empty words', () => {
    const { deps } = transactionalFakes([]);
    expect(() => addFridgeLine(deps, '   ', TODAY)).toThrow();
  });

  it('used up removes just that line', () => {
    const { deps } = transactionalFakes([]);
    addFridgeLine(deps, 'rice', TODAY);
    addFridgeLine(deps, 'beans', TODAY);
    usedUpFridgeLine(deps, fridgeLines(deps, TODAY)[0].id);
    expect(fridgeLines(deps, TODAY)).toHaveLength(1);
  });

  it('drops off by itself after the default days, with no job', () => {
    const { deps } = transactionalFakes([]);
    addFridgeLine(deps, 'rice', TODAY);
    expect(fridgeLines(deps, LATER)).toHaveLength(1);
    expect(fridgeLines(deps, TOO_LATE)).toEqual([]);
    addFridgeLine(deps, 'beans', TOO_LATE);
    expect(fridgeLines(deps, TOO_LATE).map(l => l.text)).toEqual(['beans']);
  });

  it('survives garbage in the setting', () => {
    const { deps } = transactionalFakes([]);
    deps.household.saveSetting('fridge', '{nope');
    expect(fridgeLines(deps, TODAY)).toEqual([]);
  });

  it('tells Claude oldest first and never touches the pantry', () => {
    const { deps } = transactionalFakes([]);
    const pantry = JSON.stringify(deps.pantry.list());
    addFridgeLine(deps, 'rice', TODAY);
    addFridgeLine(deps, 'dinner bits', TODAY, '2026-11-02');
    expect(fridgeForClaude(deps, TODAY).map(l => l.text)).toEqual(['dinner bits', 'rice']);
    expect(JSON.stringify(deps.pantry.list())).toBe(pantry);
  });
});
