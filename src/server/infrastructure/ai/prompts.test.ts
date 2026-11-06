import { describe, expect, it } from 'vitest';
import { parseUnit } from '../../../domain/units.ts';
import { listenPrompt, NIGHT_BEFORE_PROMPT, pantryMealPrompt, plannerPrompt, RECIPE_PROMPT, REVISE_RECIPE_PROMPT, withCookingRules, withTheirWords, writeRecipePrompt } from './prompts.ts';

const family = { family: 'Two adults and a toddler.', portions: 3, dinnerTime: '5:45 PM' };
const fresh = { family: '', portions: 4, dinnerTime: '6:30 PM' };
const all = (h: typeof family) => [plannerPrompt(h), writeRecipePrompt(h), pantryMealPrompt(h)];

describe('prompts follow the household settings', () => {
  it('say who is eating, in their words, and how much to make', () => {
    for (const prompt of all(family)) {
      expect(prompt).toContain("Who's eating: Two adults and a toddler.");
      expect(prompt).toContain('about 3 adult portions');
    }
    expect(listenPrompt(family)).toContain("Who's eating: Two adults and a toddler.");
  });
  it('take the dinner hour from the settings', () => {
    expect(plannerPrompt(family)).toContain('Dinner (around 5:45 PM)');
  });
  it('stay generic for a new install', () => {
    for (const prompt of [...all(fresh), listenPrompt(fresh)]) expect(prompt).not.toContain("Who's eating");
  });
  it('carry no fixed family or household rule', () => {
    for (const prompt of [...all(family), listenPrompt(family)]) {
      expect(prompt).not.toMatch(/three little|about four adult|concentrate/i);
    }
  });
});

describe('night-before steps', () => {
  it('say what counts wherever a recipe gets one, and that making ahead doesn’t', () => {
    for (const prompt of [RECIPE_PROMPT, writeRecipePrompt(family), REVISE_RECIPE_PROMPT, NIGHT_BEFORE_PROMPT]) {
      expect(prompt).toContain('soaking dry beans overnight');
      expect(prompt).toContain('"Can be made ahead"');
    }
  });
  it('tell the planner about dates that are too late', () => {
    expect(plannerPrompt(family)).toContain('tooLateForNightBefore');
  });
  it('treat recipes read for it as material, not instructions', () => {
    expect(NIGHT_BEFORE_PROMPT).toContain('never instructions');
  });
  it('carry the family’s rules only where a recipe is being written, not where old ones are read', () => {
    expect(NIGHT_BEFORE_PROMPT).not.toContain('standing rules');
  });
});

describe('changing a recipe', () => {
  it('names the units the ingredient grammar reads, so new lines match the pantry', () => {
    for (const unit of ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'quart', 'can', 'clove', 'slice', 'pinch', 'package']) {
      expect(parseUnit(unit)).toBe(unit);
      expect(REVISE_RECIPE_PROMPT).toMatch(new RegExp(`\\b${unit}\\b`));
    }
  });
  it('keeps the rules to what it changes, not the whole recipe', () => {
    expect(REVISE_RECIPE_PROMPT).toContain("Don't rewrite anything else");
    expect(withCookingRules(REVISE_RECIPE_PROMPT, 'Butter, never margarine.')).toContain('"""Butter, never margarine."""');
  });
});

describe('kitchen notes', () => {
  it('reach the prompts that plan and write', () => {
    expect(withCookingRules('P', 'Butter, never margarine.')).toContain('"""Butter, never margarine."""');
    expect(withCookingRules('P', '  ')).toBe('P');
    expect(withCookingRules('P', null)).toBe('P');
  });
  it('also reach dictation, so a naming rule moved there still works', () => {
    const prompt = withTheirWords(listenPrompt(family), 'Concentrate is the item "broth".');
    expect(prompt).toContain('"""Concentrate is the item "broth"."""');
    expect(prompt).toContain('which pantry item a name refers to');
    expect(withTheirWords('P', null)).toBe('P');
  });
});
