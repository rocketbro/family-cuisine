// Changing the list from the list: we've got it, not this trip, and grab something else.
import type { ISODate } from '../../domain/dates.ts';
import { COUNT_LOW_AT, nameKey, type PantryItem } from '../../domain/pantry.ts';
import { restocked } from '../../domain/portions.ts';
import { isOneOffKey, itemNamed, oneOffKey, sameThing } from '../../domain/trip-edits.ts';
import type { Deps } from './deps.ts';
import { addPantryItem, updatePantryItem } from './pantry.ts';
import { shoppingWeek } from './shopping.ts';
import { changeTripPlan } from './trip-plan.ts';
import { withoutTicks } from './trip-ticks.ts';
import { UserError } from './user-error.ts';

/**
 * "We've actually got it": the pantry changes so the line goes. Worked out from the list as it is now,
 * so a repeat finds the line gone and changes nothing.
 */
export function lineInHouse(deps: Deps, today: ISODate, key: string): void {
  deps.unitOfWork.run(() => {
    const week = shoppingWeek(deps, today);
    const line = week.lines.find(l => l.key === key);
    if (!line) return;
    const item = line.pantryItemId !== null ? deps.pantry.get(line.pantryItemId) : null;
    if (item) updatePantryItem(deps, item.id, inHouse(item, line.quantity));
    // A recipe wants it and the pantry's never heard of it. It's in the house, so it's "as needed" from here. A one-off just goes.
    else if (!isOneOffKey(key)) addPantryItem(deps, { name: line.name, status: 'have', occasional: true });
    // Some lines stand whatever the pantry says (a counted item a recipe doesn't count), and tapping this still has to clear them.
    const stays = shoppingWeek(deps, today).lines.some(l => l.key === key);
    changeTripPlan(deps, week.shopDate, plan => ({
      ...withoutTicks(plan, [key]),
      skipped: stays && !isOneOffKey(key) ? [...plan.skipped, key] : plan.skipped,
      oneOffs: plan.oneOffs.filter(o => oneOffKey(o.name) !== key),
    }));
  });
}

/** Enough that the line goes and the count and status agree. How many is a guess, and the smallest that does it. */
function inHouse(item: PantryItem, short: number | null) {
  if (item.count !== null) return { count: Math.max(item.count + (short ?? 0), COUNT_LOW_AT + 1) };
  return item.portions.length ? { status: 'have' as const, portions: [restocked(item.portions)] } : { status: 'have' as const };
}

/** Off the list and the total for this trip, or back on. It's kept with this trip, so next trip it's back by itself. */
export function skipLine(deps: Deps, today: ISODate, key: string, skipped: boolean): void {
  const { shopDate } = shoppingWeek(deps, today);
  changeTripPlan(deps, shopDate, plan => {
    const others = plan.skipped.filter(k => k !== key);
    return { skipped: skipped ? [...others, key] : others, ...(skipped ? withoutTicks(plan, [key]) : {}) };
  });
}

/** Typed onto the list. Something already on it stays one line, and something skipped comes back. */
export function addOneOff(deps: Deps, today: ISODate, typed: string): { already: boolean } {
  const name = typed.trim();
  if (!nameKey(name).length) throw new UserError('Type what to get.');
  const week = shoppingWeek(deps, today);
  const item = itemNamed(name, deps.pantry.list());
  const held = week.skipped.find(l => sameThing(l, name, item));
  if (held) {
    skipLine(deps, today, held.key, false);
    return { already: false };
  }
  if (week.lines.some(l => sameThing(l, name, item))) return { already: true };
  changeTripPlan(deps, week.shopDate, plan => ({ oneOffs: [...plan.oneOffs, { name, cents: null, walmartItemId: null }] }));
  return { already: false };
}
