// What a control can ask of a pantry item, and what it hears back.
import type { PantryItem } from '../../../domain/pantry.ts';
import type { StockToAdd } from '../../../domain/portion-add.ts';
import type { PortionMove } from '../../../domain/portion-move.ts';
import type { Portion, Storage } from '../../../domain/portions.ts';

/** A plain change shows at once; a move or an addition is worked out by the server. */
export type ItemChange = Partial<Omit<PantryItem, 'id'>> & { move?: PortionMove; add?: StockToAdd };

/** Resolves to whether it saved. */
export type SaveChange = (change: ItemChange) => Promise<boolean>;

/** The item's portions with one changed. An amount of 0 tells the server to remove it. */
export function portionsWith(portions: readonly Portion[], storage: Storage, change: Partial<Portion>): Portion[] {
  return portions.map(p => (p.storage === storage ? { ...p, ...change } : p));
}

export const STORAGE_LABEL: Record<Storage, string> = { fresh: 'Fresh', frozen: 'Frozen', canned: 'Canned', dried: 'Dried' };
export const MOVE_LABEL: Partial<Record<Storage, string>> = { frozen: 'Move to freezer', fresh: 'Move to fridge' };
