// What's left in the house once a meal is cooked, so a planning run can hold several meals to one
// pantry. Only known amounts come down: counts and measured portions. An item that's simply "have"
// stays that way, because nothing says how much of it a meal takes.
import { countable } from './availability.ts';
import type { Ingredient } from './ingredient.ts';
import { findPantryItem, statusForCount, type PantryItem } from './pantry.ts';
import { portionsAfterCooking } from './portion-amounts.ts';

export function pantryAfterMeal(pantry: readonly PantryItem[], ingredients: readonly Ingredient[], factor = 1): PantryItem[] {
  let running = [...pantry];
  for (const ingredient of ingredients) {
    if (ingredient.optional) continue;
    const item = findPantryItem(ingredient.item, running);
    if (!item || item.staple) continue;
    running = running.map(p => (p.id === item.id ? afterUsing(p, ingredient, factor) : p));
  }
  return running;
}

function afterUsing(item: PantryItem, ingredient: Ingredient, factor: number): PantryItem {
  if (item.portions.length) {
    const changes = portionsAfterCooking(item.portions, ingredient, factor);
    const portions = item.portions.flatMap(portion => {
      const change = changes.find(c => c.storage === portion.storage);
      if (!change) return [portion];
      return change.amount !== null && change.amount <= 0 ? [] : [{ ...portion, amount: change.amount, unit: change.unit }];
    });
    return { ...item, portions, status: portions.length ? item.status : 'out' };
  }
  if (item.count !== null && ingredient.amount !== null && countable(ingredient)) {
    const count = Math.max(0, item.count - ingredient.amount * factor);
    return { ...item, count, status: statusForCount(count) };
  }
  return item;
}
