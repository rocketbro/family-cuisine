// Something bought instead of a list line stands in for it through the item's `alsoCalled`, the
// pantry's own way of saying two names are interchangeable: while it's in the house, recipes and
// the list take it for the original (`findPantryItem`, `standingIn`). "Always fine instead" keeps
// the name for good. "Just this time" also notes it in `household_settings.stand_ins_for_now`, and
// the name comes off once the item runs out, so the original goes back on the list the normal way.
import { nameKey, type PantryItem } from '../../domain/pantry.ts';
import type { Deps } from './deps.ts';

const KEY = 'stand_ins_for_now';

type ForNow = { itemId: number; name: string };

const sameName = (a: string, b: string) => nameKey(a).join(' ') === nameKey(b).join(' ');

function forNow(deps: Deps): ForNow[] {
  return JSON.parse(deps.household.setting(KEY) ?? '[]') as ForNow[];
}

function saveForNow(deps: Deps, entries: ForNow[]): void {
  deps.household.saveSetting(KEY, entries.length ? JSON.stringify(entries) : null);
}

/** `item` stands in for `name` from now on (`always`), or until it runs out. */
export function standIn(deps: Deps, item: PantryItem, name: string, always: boolean): void {
  if (sameName(item.name, name)) return;
  const current = deps.pantry.get(item.id) ?? item;
  const known = current.alsoCalled.some(other => sameName(other, name));
  const entries = forNow(deps);
  const temporary = entries.some(e => e.itemId === item.id && sameName(e.name, name));
  // Only the alias changes, so none of updatePantryItem's stock rules apply.
  if (!known) deps.pantry.update(item.id, { alsoCalled: [...current.alsoCalled, name] });
  if (always && temporary) saveForNow(deps, entries.filter(e => !(e.itemId === item.id && sameName(e.name, name))));
  // A name the family had already given it stays theirs.
  if (!always && !known) saveForNow(deps, [...entries, { itemId: item.id, name }]);
}

/** Once an item has run out, names it stood in for just this time come off it. */
export function forgetStandInsOnceOut(deps: Deps, item: PantryItem | null): PantryItem | null {
  if (!item || item.status !== 'out') return item;
  const entries = forNow(deps);
  const mine = entries.filter(e => e.itemId === item.id);
  if (!mine.length) return item;
  saveForNow(deps, entries.filter(e => e.itemId !== item.id));
  const alsoCalled = item.alsoCalled.filter(other => !mine.some(e => sameName(e.name, other)));
  return deps.pantry.update(item.id, { alsoCalled }) ?? item;
}

/** A removed item stands in for nothing. */
export function forgetStandIns(deps: Deps, itemId: number): void {
  const entries = forNow(deps);
  if (entries.some(e => e.itemId === itemId)) saveForNow(deps, entries.filter(e => e.itemId !== itemId));
}

/** The names standing in just this time, for the tidy-up to compare with what is out. */
export function standInsForNow(deps: Deps): ForNow[] {
  return forNow(deps);
}
