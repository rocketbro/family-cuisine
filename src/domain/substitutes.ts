// "Can I use something else?" For a recipe's ingredients: which common swaps apply, what
// each would take at this batch size, and whether the pantry has it. A chosen set of swaps
// turns the recipe into a working copy, which cook mode and "Done making this" use.
import { ingredientStock } from './availability.ts';
import type { Ingredient } from './ingredient.ts';
import { endsWith, findPantryItem, nameKey, type PantryItem } from './pantry.ts';
import { ALWAYS_ON_HAND, SUBSTITUTE_RULES, type SubstituteOption, type SubstituteRule } from './substitute-rules.ts';
import { convert, dimensionOf, type Unit } from './units.ts';

/** Chosen swaps: ingredient index in the recipe → option id. */
export type Substitutions = Readonly<Record<number, string>>;

export type SubstituteChoice = SubstituteOption & {
  /** The swap's ingredients at this recipe's amount, ready to cook with. */
  ingredients: Ingredient[];
  /** Exact amounts couldn't be worked out (the recipe says "a knob of butter"). */
  approximate: boolean;
  /** Pantry names of anything the swap needs that isn't on hand. */
  missing: string[];
};

export type SubstitutableIngredient = { index: number; ingredient: Ingredient; options: SubstituteChoice[] };

export function ruleFor(itemName: string): SubstituteRule | null {
  const key = nameKey(itemName);
  let best: { rule: SubstituteRule; length: number } | null = null;
  for (const rule of SUBSTITUTE_RULES) {
    if (rule.not?.some(n => endsWith(key, nameKey(n)))) continue;
    for (const name of rule.names) {
      const words = nameKey(name);
      if (endsWith(key, words) && (!best || words.length > best.length)) best = { rule, length: words.length };
    }
  }
  return best?.rule ?? null;
}

/** Every ingredient that has a swap, with each option priced against the pantry. */
export function substitutesFor(ingredients: readonly Ingredient[], pantry: readonly PantryItem[], factor = 1): SubstitutableIngredient[] {
  const out: SubstitutableIngredient[] = [];
  ingredients.forEach((ingredient, index) => {
    const rule = ruleFor(ingredient.item);
    if (!rule) return;
    const options = rule.options.map(option => choice(ingredient, rule, option, pantry, factor));
    out.push({ index, ingredient, options: options.sort((a, b) => a.missing.length - b.missing.length) });
  });
  return out;
}

/** The recipe with the chosen swaps put in, each swapped line noting what it replaces. */
export function applySubstitutions(ingredients: readonly Ingredient[], chosen: Substitutions): Ingredient[] {
  return ingredients.flatMap((ingredient, index) => {
    const id = chosen[index];
    const rule = id ? ruleFor(ingredient.item) : null;
    const option = rule?.options.find(o => o.id === id);
    if (!rule || !option) return [ingredient];
    return scaledUses(ingredient, rule, option).ingredients.map(i => ({ ...i, note: `instead of ${ingredient.item}`, group: ingredient.group }));
  });
}

/** Chosen swaps written compactly for a URL or storage: "3:flax-egg,5:honey". */
export function encodeSubstitutions(chosen: Substitutions): string {
  return Object.entries(chosen).map(([i, id]) => `${i}:${id}`).join(',');
}

export function decodeSubstitutions(text: string | null | undefined): Substitutions {
  const out: Record<number, string> = {};
  for (const part of (text ?? '').split(',')) {
    const [i, id] = part.split(':');
    if (/^\d+$/.test(i ?? '') && id) out[Number(i)] = id;
  }
  return out;
}

function choice(
  ingredient: Ingredient, rule: SubstituteRule, option: SubstituteOption, pantry: readonly PantryItem[],
  factor: number,
): SubstituteChoice {
  const { ingredients, approximate } = scaledUses(ingredient, rule, option);
  const missing = ingredients
    .filter(i => !ALWAYS_ON_HAND.includes(i.item))
    .filter(i => ['missing', 'short'].includes(ingredientStock(i, pantry, factor)))
    .map(i => findPantryItem(i.item, pantry)?.name ?? i.item);
  return { ...option, ingredients, approximate, missing };
}

/** How many of the rule's "per" amount the recipe calls for; null when the units don't line up. */
function ratio(ingredient: Ingredient, rule: SubstituteRule): number | null {
  if (ingredient.amount === null) return null;
  const from = ingredient.unit;
  const to = rule.per.unit;
  if (from === to) return ingredient.amount / rule.per.amount;
  if (from && to && dimensionOf(from) === dimensionOf(to) && dimensionOf(from) !== 'count') return convert(ingredient.amount, from, to) / rule.per.amount;
  return null;
}

function scaledUses(ingredient: Ingredient, rule: SubstituteRule, option: SubstituteOption): { ingredients: Ingredient[]; approximate: boolean } {
  const r = ratio(ingredient, rule);
  return {
    approximate: r === null,
    ingredients: option.uses.map(u => {
      const measured = r === null ? null : spoonable(u.amount * r, u.unit);
      return { amount: measured?.amount ?? null, amountMax: null, unit: measured?.unit ?? null, item: u.item, note: null, optional: false, group: ingredient.group };
    }),
  };
}

/** Small amounts of a cup read better in spoons: ⅛ cup of honey is 2 tbsp. */
function spoonable(amount: number, unit: Unit | null): { amount: number; unit: Unit | null } {
  if (unit === 'cup' && amount < 0.25) return { amount: round(convert(amount, 'cup', 'tbsp')), unit: 'tbsp' };
  return { amount: round(amount), unit };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

